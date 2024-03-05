(ns ^:mb/once metabase-enterprise.audit-app.api.user-test
  (:require
   [clojure.test :refer :all]
   [metabase-enterprise.audit-app.permissions-test :as ee-perms-test]
   [metabase-enterprise.audit-db :as audit-db]
   [metabase.models.permissions :as perms]
   [metabase.models.permissions-group :as perms-group]
   [metabase.test :as mt]))

(deftest get-audit-info-test
  (testing "GET /api/ee/audit-app/user/audit-info"
    (mt/with-premium-features #{:audit-app}
      (ee-perms-test/install-audit-db-if-needed!)
      (testing "None of the ids show up when perms aren't given"
        (perms/revoke-collection-permissions! (perms-group/all-users) (audit-db/default-custom-reports-collection))
        (perms/revoke-collection-permissions! (perms-group/all-users) (audit-db/default-audit-collection))
        (is (= #{}
               (->>
                (mt/user-http-request :rasta :get 200 "/ee/audit-app/user/audit-info")
                keys
                (into #{})))))
      (testing "Custom reports collection shows up when perms are given"
        (perms/grant-collection-read-permissions! (perms-group/all-users) (audit-db/default-custom-reports-collection))
        (is (= #{:custom_reports}
               (->>
                (mt/user-http-request :rasta :get 200 "/ee/audit-app/user/audit-info")
                keys
                (into #{})))))
      (testing "Everything shows up when all perms are given"
        (perms/grant-collection-read-permissions! (perms-group/all-users) (audit-db/default-audit-collection))
        (is (= #{:question_overview :dashboard_overview :custom_reports}
               (->>
                (mt/user-http-request :rasta :get 200 "/ee/audit-app/user/audit-info")
                keys
                (into #{}))))))))
