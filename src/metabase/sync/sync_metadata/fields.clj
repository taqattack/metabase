(ns metabase.sync.sync-metadata.fields
   "Logic for updating Metabase Field models from metadata fetched from a physical DB.

  The basic idea here is to look at the metadata we get from calling `describe-table` on a connected database, then
  construct an identical set of metadata from what we have about that Table in the Metabase DB. Then we iterate over
  both sets of Metadata and perform whatever steps are needed to make sure the things in the DB match the things that
  came back from `describe-table`. These steps are broken out into three main parts:

  * Fetch Metadata - logic is in `metabase.sync.sync-metadata.fields.fetch-metadata`. Construct a map of metadata from
    the Metabase application database that matches the form of DB metadata about Fields in a Table. This metadata is
    used to next two steps to determine what sync operations need to be performed by comparing the differences in the
    two sets of Metadata.

  * Sync Field instances -- logic is in `metabase.sync.sync-metadata.fields.sync-instances`. Make sure the `Field`
    instances in the Metabase application database match up with those in the DB metadata, creating new Fields as
    needed, and marking existing ones as active or inactive as appropriate.

  * Update instance metadata -- logic is in `metabase.sync.sync-metadata.fields.sync-metadata`. Update metadata
    properties of `Field` instances in the application database as needed -- this includes the base type, database type,
    semantic type, and comment/remark (description) properties. This primarily affects Fields that were not newly
    created; newly created Fields are given appropriate metadata when first synced (by `sync-instances`).

  A note on terminology used in `metabase.sync.sync-metadata.fields.*` namespaces:

  * `db-metadata` is a set of `field-metadata` maps coming back from the DB (e.g. from something like JDBC
    `DatabaseMetaData`) describing the columns (or equivalent) currently present in the table (or equivalent) that we're
    syncing.

  *  `field-metadata` is a map of information describing a single columnn currently present in the table being synced

  *  `our-metadata` is a set of maps of Field metadata reconstructed from the Metabase application database.

  *  `metabase-field` is a single map of Field metadata reconstructed from the Metabase application database; there is
     a 1:1 correspondance between this metadata and a row in the `Field` table. Unlike `field-metadata`, these entries
     always have an `:id` associated with them (because they are present in the Metabase application DB).

  Other notes:

  * In general the methods in these namespaces return the number of rows updated; these numbers are summed and used
    for logging purposes by higher-level sync logic."
   (:require
    [medley.core :as m]
    [metabase.driver :as driver]
    [metabase.driver.util :as driver.u]
    [metabase.models.table :as table]
    [metabase.sync.interface :as i]
    [metabase.sync.sync-metadata.fields.fetch-metadata :as fetch-metadata]
    [metabase.sync.sync-metadata.fields.sync-instances :as sync-instances]
    [metabase.sync.sync-metadata.fields.sync-metadata :as sync-metadata]
    [metabase.sync.util :as sync-util]
    [metabase.util.malli :as mu]
    [metabase.util.malli.schema :as ms]))

;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                            PUTTING IT ALL TOGETHER                                             |
;;; +----------------------------------------------------------------------------------------------------------------+

 (mu/defn ^:private sync-and-update! :- ms/IntGreaterThanOrEqualToZero
   "Sync Field instances (i.e., rows in the Field table in the Metabase application DB) for a Table, and update metadata
  properties (e.g. base type and comment/remark) as needed. Returns number of Fields synced."
   [table       :- i/TableInstance
    db-metadata :- (ms/CollectionOf i/TableMetadataField)]
   (+ (sync-instances/sync-instances! table db-metadata (fetch-metadata/our-metadata table))
     ;; Now that tables are synced and fields created as needed make sure field properties are in sync.
     ;; Re-fetch our metadata because there might be somethings that have changed after calling
     ;; `sync-instances`
      (sync-metadata/update-metadata! table db-metadata (fetch-metadata/our-metadata table))))

 (mu/defn ^:private sync-and-update-tables! :- ms/IntGreaterThanOrEqualToZero
   "Sync Field instances (i.e., rows in the Field table in the Metabase application DB) for a Table, and update metadata
  properties (e.g. base type and comment/remark) as needed. Returns number of Fields synced."
   [tables      :- [:sequential i/TableInstance]
    db-metadata :- [:sequential [:sequential i/TableMetadataField]]]
   (let [table->ident    (juxt :schema :name)
         metadata->ident (juxt :table-schema :table-name)
         ident->table    (m/index-by table->ident tables)
         table+metadata  (keep (fn [metadata]
                                 (when-let [table (ident->table (metadata->ident (first metadata)))]
                                   {:table    table
                                    :metadata metadata}))
                               db-metadata)]
     (reduce + 0
             (for [{:keys [table metadata]} table+metadata]
               (+ (sync-instances/sync-instances! table metadata (fetch-metadata/our-metadata table))
                  ;; Now that tables are synced and fields created as needed make sure field properties are in sync.
                  ;; Re-fetch our metadata because there might be somethings that have changed after calling
                  ;; `sync-instances`
                  (sync-metadata/update-metadata! table metadata (fetch-metadata/our-metadata table)))))))

 (mu/defn sync-fields-for-table!
   "Sync the Fields in the Metabase application database for a specific `table`."
   ([table :- i/TableInstance]
    (sync-fields-for-table! (table/database table) table))

   ([database :- i/DatabaseInstance
     table    :- i/TableInstance]
    (sync-util/with-error-handling (format "Error syncing Fields for Table ''%s''" (sync-util/name-for-logging table))
      (let [db-metadata (fetch-metadata/db-metadata database table)]
        {:total-fields   (count db-metadata)
         :updated-fields (sync-and-update! table db-metadata)}))))

 (mu/defn sync-fields-for-tables!
   "Sync the Fields in the Metabase application database for a specific `table`."
   [database  :- i/DatabaseInstance
    tables    :- [:sequential i/TableInstance]]
   (sync-util/with-error-handling (format "Error syncing Fields for Database ''%s''" (sync-util/name-for-logging database))
     (let [db-metadata (fetch-metadata/fields-metadata database)]
       {:total-fields   (count db-metadata) ;; this is misleading because total-fields includes pg_catalog fields etc
        :updated-fields (sync-and-update-tables! tables db-metadata)})))

 (mu/defn sync-fields! :- [:maybe
                           [:map
                            [:updated-fields ms/IntGreaterThanOrEqualToZero]
                            [:total-fields   ms/IntGreaterThanOrEqualToZero]]]
   "Sync the Fields in the Metabase application database for all the Tables in a `database`."
   [database :- i/DatabaseInstance]
   (let [tables (sync-util/db->sync-tables database)]
     (if (driver/database-supports? (driver.u/database->driver database)
                                    :fast-sync-fields
                                    database)
       (sync-fields-for-tables! database tables)
       (->> tables
            (map (partial sync-fields-for-table! database))
            (remove (partial instance? Throwable))
            (apply merge-with +)))))
