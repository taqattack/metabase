(ns metabase-enterprise.audit-app.api.user
  "`/api/ee/audit-app/user` endpoints. These only work if you have a premium token with the `:audit-app` feature."
  (:require
   [compojure.core :refer [GET]]
   [metabase-enterprise.audit-db :as audit-db]
   [metabase.api.common :as api]
   [metabase.models.interface :as mi]
   [metabase.util :as u]))

(api/defendpoint GET "/audit-info"
  "Returns slugs and IDs for important audit collections and dashboards for the current user if they have permission to
  access the audit collection. Otherwise return an empty map."
  []
  (let [custom-reports     (audit-db/default-custom-reports-collection)
        question-overview  (audit-db/entity-id->object :model/Dashboard audit-db/default-question-overview-entity-id)
        dashboard-overview (audit-db/entity-id->object :model/Dashboard audit-db/default-dashboard-overview-entity-id)]
    (merge
     {}
     (when (mi/can-read? (audit-db/default-custom-reports-collection))
       {(:slug custom-reports) (:id custom-reports)})
     (when (mi/can-read? (audit-db/default-audit-collection))
       {(u/slugify (:name question-overview)) (:id question-overview)
        (u/slugify (:name dashboard-overview)) (:id dashboard-overview)}))))

(api/define-routes)
