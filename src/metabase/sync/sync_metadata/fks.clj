(ns metabase.sync.sync-metadata.fks
  "Logic for updating FK properties of Fields from metadata fetched from a physical DB."
  (:require
   [metabase.driver :as driver]
   [metabase.driver.util :as driver.u]
   [metabase.models.field :refer [Field]]
   [metabase.models.table :as table :refer [Table]]
   [metabase.sync.fetch-metadata :as fetch-metadata]
   [metabase.sync.interface :as i]
   [metabase.sync.util :as sync-util]
   [metabase.util :as u]
   [metabase.util.log :as log]
   [metabase.util.malli :as mu]
   [toucan2.core :as t2]))

(def ^:private FKRelationshipObjects
  "Relevant objects for a foreign key relationship."
  [:map
   [:source-field i/FieldInstance]
   [:dest-table   i/TableInstance]
   [:dest-field   i/FieldInstance]])

(defn- active-field [table-id field-name]
  (t2/select-one Field
                 :table_id           table-id
                 :%lower.name        (u/lower-case-en field-name)
                 {:where sync-util/syncable-field-clause}))

(defn- active-table [db-id schema-name table-name]
  (t2/select-one Table
                 :db_id           db-id
                 :%lower.name     (u/lower-case-en table-name)
                 :%lower.schema   (some-> schema-name u/lower-case-en)
                 {:where sync-util/syncable-table-clause}))

(defn- active-non-fk-field [table-id field-name]
  (t2/select-one Field
                 :table_id           table-id
                 :%lower.name        (u/lower-case-en field-name)
                 :fk_target_field_id nil
                 {:where sync-util/syncable-field-clause}))

(mu/defn ^:private fetch-fk-relationship-objects :- [:maybe FKRelationshipObjects]
  "Fetch the Metabase objects (Tables and Fields) that are relevant to a foreign key relationship described by FK."
  [database :- i/DatabaseInstance
   table    :- i/TableInstance
   fk       :- i/FKMetadataEntry]
  ;; FIXME: using active-non-fk-field preserves existing behaviour but is a bug!
  ;; This means that foreign key relationships can never change
  (when-let [source-field (active-non-fk-field (u/the-id table) (:fk-column-name fk))]
    (when-let [dest-table (active-table (u/the-id database) (:schema (:dest-table fk)) (:name (:dest-table fk)))]
      (when-let [dest-field (active-field (u/the-id dest-table) (:dest-column-name fk))]
        {:source-field source-field
         :dest-table   dest-table
         :dest-field   dest-field}))))

(defn ^:private mark-fk!
  [{:keys [pk-field-id fk-field-id]}]
  (t2/update! Field fk-field-id
              {:semantic_type      :type/FK
               :fk_target_field_id pk-field-id}))

(mu/defn sync-fks-for-tables!
  "Sync the foreign keys for specific `tables`."
  [database :- i/DatabaseInstance
   tables] ; `tables` is a reducible collection of Table instances
  (sync-util/with-error-handling (format "Error syncing FKs for %s" (sync-util/name-for-logging database))
    (let [;; TODO: we can use the schema filters prop to narrow down the schemas we need to fetch fks for
          ;; using [[fetch-metadata/fk-metadata]]. For now, we'll fetch all the fks and filter them with the
          ;; tables we have in memory.
          fk-metadata    (fetch-metadata/fk-metadata database)
          table->ident   (juxt :schema :name)
          ;; TODO: This keeps table and schema ids in memory. We should fix this.
          ident->table-id (persistent! (reduce #(assoc! %1 (table->ident %2) (:id %2)) (transient {}) tables))
          maybe-fks       (eduction (map (fn [{:keys [fk-table dest-table fk-column-name dest-column-name]}]
                                           (when-let [fk-table-id (ident->table-id (table->ident fk-table))]
                                             (when-let [dest-table-id (ident->table-id (table->ident dest-table))]
                                               (when-let [fk-field (active-non-fk-field fk-table-id fk-column-name)]
                                                 (when-let [pk-field (active-field dest-table-id dest-column-name)]
                                                   {:fk-field-id fk-field
                                                    :pk-field-id pk-field}))))))
                                    fk-metadata)]
      (u/prog1 (reduce (fn [update-info maybe-fk]
                         (some-> maybe-fk mark-fk!)
                         (merge-with + update-info {:total-fks    1
                                                    :updated-fks  (if maybe-fk 1 0)
                                                    :total-failed 0}))
                       {:total-fks    0
                        :updated-fks  0
                        :total-failed 0}
                       maybe-fks)
        ;; Mark tables as done with its initial sync once this step is done even if it failed, because only
        ;; sync-aborting errors should be surfaced to the UI (see
        ;; `:metabase.sync.util/exception-classes-not-to-retry`).
        (run! sync-util/set-initial-table-sync-complete! tables)))))

(mu/defn sync-fks-for-table!
  "Sync the foreign keys for a specific `table`."
  ([table :- i/TableInstance]
   (sync-fks-for-table! (table/database table) table))

  ([database :- i/DatabaseInstance
    table    :- i/TableInstance]
   (sync-util/with-error-handling (format "Error syncing FKs for %s" (sync-util/name-for-logging table))
     (let [fks-to-update (fetch-metadata/table-fk-metadata database table)]
       {:total-fks   (count fks-to-update)
        :updated-fks (sync-util/sum-numbers
                      (fn [fk]
                        (if-let [{:keys [source-field
                                         dest-table
                                         dest-field]} (fetch-fk-relationship-objects database table fk)]
                          (do
                            (log/info (u/format-color 'cyan "Marking foreign key from %s %s -> %s %s"
                                                      (sync-util/name-for-logging table)
                                                      (sync-util/name-for-logging source-field)
                                                      (sync-util/name-for-logging dest-table)
                                                      (sync-util/name-for-logging dest-field)))
                            (mark-fk! {:pk-field-id (:id dest-field)
                                       :fk-field-id (:id source-field)})
                            1)
                          0))
                      fks-to-update)}))))

(mu/defn sync-fks!
  "Sync the foreign keys in a `database`. This sets appropriate values for relevant Fields in the Metabase application
  DB based on values from the `FKMetadata` returned by [[metabase.driver/describe-table-fks]].

  If the driver supports the `:fast-sync-fks` feature, [[metabase.driver/describe-fks]] is used to fetch the FK metadata."
  [database :- i/DatabaseInstance]
  (if (driver/database-supports? (driver.u/database->driver database)
                                 :fast-sync-fks
                                 database)
    (->> (sync-util/reducible-sync-tables database)
         (sync-fks-for-tables! database))
    (reduce (fn [update-info table]
              (let [table-fk-info (sync-fks-for-table! database table)]
                ;; Mark the table as done with its initial sync once this step is done even if it failed, because only
                ;; sync-aborting errors should be surfaced to the UI (see
                ;; `:metabase.sync.util/exception-classes-not-to-retry`).
                (sync-util/set-initial-table-sync-complete! table)
                (if (instance? Exception table-fk-info)
                  (update update-info :total-failed inc)
                  (merge-with + update-info table-fk-info))))
            {:total-fks    0
             :updated-fks  0
             :total-failed 0}
            (sync-util/reducible-sync-tables database))))
