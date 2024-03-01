import { t } from "ttag";
import type { Action as KBarAction } from "kbar";
import { useMemo } from "react";
import { push } from "react-router-redux";
import type { SearchResult } from "metabase-types/api";
import {
  useRecentItemListQuery,
  useSearchListQuery,
} from "metabase/common/hooks";
import Search from "metabase/entities/search";
import { useDispatch } from "metabase/lib/redux";
import { closeModal } from "metabase/redux/ui";
import { Icon } from "metabase/ui";
import { getIcon, getName } from "metabase/entities/recent-items";
import * as Urls from "metabase/lib/urls";

export type PalettePageId = "root" | "admin_settings";

// type AdminSetting = {
//   key: string;
//   display_name: string;
//   description: string | null;
//   type?: "string";
//   path: string;
// };

export const useCommandPalette = ({
  query,
  debouncedSearchText,
}: {
  query: string;
  debouncedSearchText: string;
}) => {
  const dispatch = useDispatch();
  // const adminSections =
  //   useSelector<Record<string, { name: string; settings: AdminSetting[] }>>(
  //     getSections,
  //   );

  // useEffect(() => {
  //   dispatch(reloadSettings());
  // }, [dispatch]);

  // const adminSettings = useMemo(() => {
  //   return Object.keys(adminSections).reduce<AdminSetting[]>((memo, key) => {
  //     const settings: AdminSetting[] = adminSections[key].settings || [];
  //     const path = `/admin/settings/${key}`;
  //     const acc: AdminSetting[] = [
  //       ...memo,
  //       ...settings
  //         .filter(s => s.display_name)
  //         .map(s => ({
  //           name: s.display_name || "",
  //           description: s.description,
  //           path,
  //           key: s.key,
  //           display_name: `${key[0].toUpperCase()}${key.slice(1)} / ${
  //             s.display_name
  //           }`,
  //         })),
  //     ];
  //     return acc;
  //   }, []);
  // }, [adminSections]);

  // const adminSettingsActions: PaletteAction[] = useMemo(() => {
  //   return adminSettings.map(s => ({
  //     parent: "admin_settings",
  //     id: s.display_name,
  //     name: s.display_name,
  //     icon: <Icon name="gear" />,
  //     perform: () => {
  //       dispatch(
  //         push({
  //           pathname: s.path,
  //           hash: `#${s.key}`,
  //         }),
  //       );
  //     },
  //   }));
  // }, [adminSettings, dispatch]);

  const {
    data: searchResults,
    error: searchError,
    isLoading: isSearchLoading,
  } = useSearchListQuery<SearchResult>({
    enabled: !!debouncedSearchText,
    query: { q: debouncedSearchText, limit: 5 },
    reload: true,
  });

  const { data: recentItems } = useRecentItemListQuery({
    enabled: !debouncedSearchText,
    reload: true,
  });

  const basicActions = useMemo<KBarAction[]>(() => {
    const ret: KBarAction[] = [
      {
        id: "search_docs",
        name: query
          ? `Search documentation for "${query}"`
          : t`View documentation`,
        section: "docs",
        keywords: query, // Always match the query string
        icon: () => <Icon name="document" />,
        perform: () => {
          const host = "https://www.metabase.com";
          if (query) {
            const params = new URLSearchParams({ query: query });
            // TODO: find the documentation search URL in the right way
            window.open(`${host}/search?${params}`);
          } else {
            window.open(`${host}/docs/latest`);
          }
        },
      },
    ];
    return ret;
  }, [query]);

  const searchResultActions = useMemo<KBarAction[]>(() => {
    const ret: KBarAction[] = [];
    if (isSearchLoading) {
      ret.push({
        id: "search-is-loading",
        name: "Loading...",
        keywords: query,
        section: "search",
      });
    } else if (searchError) {
      ret.push({
        id: "search-error",
        name: t`Could not load search results`,
        section: "search",
      });
    } else if (debouncedSearchText) {
      console.log("we goin", searchResults);
      if (searchResults?.length) {
        ret.push(
          ...searchResults.map(result => {
            const wrappedResult = Search.wrapEntity(result, dispatch);
            return {
              id: `search-result-${result.id}`,
              name: result.name,
              icon: <Icon {...wrappedResult.getIcon()} />,
              section: "search",
              perform: () => {
                dispatch(closeModal());
                dispatch(push(wrappedResult.getUrl()));
              },
            };
          }),
        );
      } else {
        ret.push({
          id: "no-search-results",
          name: t`No results for “${query}”`,
          keywords: query,
          section: "search",
        });
      }
    }
    return ret;
  }, [
    dispatch,
    query,
    debouncedSearchText,
    isSearchLoading,
    searchError,
    searchResults,
  ]);

  const recentItemsActions = useMemo<KBarAction[]>(() => {
    const ret: KBarAction[] = [];
    recentItems?.forEach(item => {
      ret.push({
        id: `recent-item-${getName(item)}`,
        name: getName(item),
        icon: <Icon name={getIcon(item).name} />,
        section: "recent",
        perform: () => {
          dispatch(push(Urls.modelToUrl(item) ?? ""));
        },
      });
    });

    return ret;
  }, [dispatch, recentItems]);

  return [...basicActions, ...searchResultActions, ...recentItemsActions];
};
