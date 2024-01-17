(ns metabase-enterprise.serialization.api
  (:require
   [clojure.java.io :as io]
   [compojure.core :refer [POST]]
   [java-time.api :as t]
   [metabase-enterprise.serialization.v2.extract :as extract]
   [metabase-enterprise.serialization.v2.ingest :as v2.ingest]
   [metabase-enterprise.serialization.v2.load :as v2.load]
   [metabase-enterprise.serialization.v2.storage :as storage]
   [metabase.api.common :as api]
   [metabase.api.defendpoint2 :refer [defendpoint2]]
   [metabase.api.routes.common :refer [+auth]]
   [metabase.logger :as logger]
   [metabase.models.serialization :as serdes]
   [metabase.public-settings :as public-settings]
   [metabase.util :as u]
   [metabase.util.compress :as u.compress]
   [metabase.util.date-2 :as u.date]
   [metabase.util.log :as log]
   [metabase.util.malli.schema :as ms]
   [metabase.util.random :as u.random]
   [ring.core.protocols :as ring.protocols])
  (:import
   (java.io File ByteArrayOutputStream)))

(set! *warn-on-reflection* true)

;;; Storage

(def parent-dir "Dir for storing serialization API export-in-progress and archives."
  (let [f (io/file (System/getProperty "java.io.tmpdir") (str "serdesv2-" (u.random/random-name)))]
    (.mkdirs f)
    (.deleteOnExit f)
    (.getPath f)))

;;; Request callbacks

(defn- ba-copy [f]
  (with-open [baos (ByteArrayOutputStream.)]
    (io/copy f baos)
    (.toByteArray baos)))

(defn- on-response! [data callback]
  (reify
    ;; Real HTTP requests and mt/user-real-request go here
    ring.protocols/StreamableResponseBody
    (write-body-to-stream [_ response out]
      (ring.protocols/write-body-to-stream data response out)
      (future (callback)))

    ;; mt/user-http-request goes here
    clojure.java.io.IOFactory
    (make-input-stream [_ _]
      (let [res (io/input-stream (if (instance? File data)
                                   (ba-copy data)
                                   data))]
        (callback)
        res))))

;;; Logic

(defn- serialize&pack ^File [{:keys [dirname] :as opts}]
  (let [dirname (or dirname
                    (format "%s-%s"
                            (u/slugify (public-settings/site-name))
                            (u.date/format "YYYY-MM-dd_HH-mm" (t/local-date-time))))
        path     (io/file parent-dir dirname)
        dst      (io/file (str (.getPath path) ".tar.gz"))
        log-file (io/file path "export.log")]
    (with-open [_logger (logger/for-ns 'metabase-enterprise.serialization log-file)]
      (try                              ; try/catch inside logging to log errors
        (serdes/with-cache
          (-> (extract/extract opts)
              (storage/store! path)))
        ;; not removing storage immediately to save some time before response
        (u.compress/tgz path dst)
        (catch Exception e
          (log/error e "Error during serialization"))))
    {:archive  (when (.exists dst)
                 dst)
     :log-file (when (.exists log-file)
                 log-file)
     :callback (fn []
                 (when (.exists path)
                   (run! io/delete-file (reverse (file-seq path))))
                 (when (.exists dst)
                   (io/delete-file dst)))}))

(defn- unpack&import [^File file & [size]]
  (let [dst      (io/file parent-dir (u.random/random-name))
        log-file (io/file dst "import.log")]
    (with-open [_logger (logger/for-ns 'metabase-enterprise.serialization log-file)]
      (try                              ; try/catch inside logging to log errors
        (log/infof "Serdes import, size %s" size)
        (let [path (u.compress/untgz file dst)]
          (serdes/with-cache
            (-> (v2.ingest/ingest-yaml (.getPath (io/file dst path)))
                (v2.load/load-metabase! {:abort-on-error true}))))
        (catch Exception e
          (log/error e "Error during serialization"))))
    {:log-file log-file
     :callback #(when (.exists dst)
                  (run! io/delete-file (reverse (file-seq dst))))}))

;;; HTTP API

(defendpoint2 POST "/export"
  "Serialize and retrieve Metabase instance.

  Outputs .tar.gz file with serialization results and an `export.log` file.
  On error just returns serialization logs."
  [{:query-params {collection       [:maybe {:mb/doc "[int], db id of a collection to serialize"}
                                     (ms/QueryVector ms/PositiveInt)]
                   all_collections  [:and {:mb/doc "bool, serialize all collections, discarded when `collection` is specified"
                                           :default true}
                                     ms/BooleanValue]
                   settings         [:and {:mb/doc "bool, if Metabase settings should be serialized"
                                           :default true}
                                     ms/BooleanValue]
                   data_model       [:and {:mb/doc "bool, if Metabase data model should be serialized"
                                           :default true}
                                     ms/BooleanValue]
                   field_values     [:and {:mb/doc "bool, if cached field values should be serialized"
                                           :default false}
                                     ms/BooleanValue]
                   database_secrets [:and {:mb/doc "bool, if details how to connect to each db should be serialized"
                                           :default false}
                                     ms/BooleanValue]
                   dirname          [:maybe {:mb/doc "string, name of a directory and an archive file (default: `<instance-name>-<YYYY-MM-dd_HH-mm>`)"}
                                     string?]}}]
  (api/check-superuser)
  (let [opts               {:targets                  (mapv #(vector "Collection" %)
                                                            collection)
                            :no-collections           (and (empty? collection)
                                                           (not all_collections))
                            :no-data-model            (not data_model)
                            :no-settings              (not settings)
                            :include-field-values     field_values
                            :include-database-secrets database_secrets
                            :dirname                  dirname}
        {:keys [archive
                log-file
                callback]} (serialize&pack opts)]
    (if archive
      {:status  200
       :headers {"Content-Type"        "application/gzip"
                 "Content-Disposition" (format "attachment; filename=\"%s\"" (.getName ^File archive))}
       :body    (on-response! archive callback)}
      {:status  500
       :headers {"Content-Type" "text/plain"}
       :body    (on-response! log-file callback)})))

(defendpoint2 ^:multipart POST "/import"
  "Deserialize Metabase instance from an archive generated by /export.

  Parameters:
  - `file`: archive encoded as `multipart/form-data` (required).

  Returns logs of deserialization."
  [{:multipart-params {file map?}}]
  (api/check-superuser)
  (try
    (let [{:keys [log-file callback]} (unpack&import (:tempfile file) (:size file))]
      {:status  200
       :headers {"Content-Type" "text/plain"}
       :body    (on-response! log-file callback)})
    (finally
      (io/delete-file (:tempfile file)))))

(api/define-routes +auth)
