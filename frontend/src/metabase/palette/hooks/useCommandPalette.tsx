import { jt, t } from "ttag";
import type { Action as KBarAction } from "kbar";
import { useEffect, useMemo } from "react";
import { push } from "react-router-redux";
import type { SearchResult } from "metabase-types/api";
import { getSections } from "metabase/admin/settings/selectors";
import { reloadSettings } from "metabase/admin/settings/settings";
import { useSearchListQuery } from "metabase/common/hooks";
import Search from "metabase/entities/search";
import { DEFAULT_SEARCH_LIMIT } from "metabase/lib/constants";
import { useDispatch, useSelector } from "metabase/lib/redux";
import { closeModal } from "metabase/redux/ui";
import { Icon, Loader } from "metabase/ui";

export type PaletteAction = KBarAction & {
  component?: React.ReactNode;
  isButton?: boolean;
};

export type PalettePageId = "root" | "admin_settings";

type AdminSetting = {
  key: string;
  display_name: string;
  description: string | null;
  type?: "string";
  path: string;
};

export const useCommandPalette = ({
  query,
  debouncedSearchText,
}: {
  query: string;
  debouncedSearchText: string;
}) => {
  const dispatch = useDispatch();
  const adminSections =
    useSelector<Record<string, { name: string; settings: AdminSetting[] }>>(
      getSections,
    );

  useEffect(() => {
    dispatch(reloadSettings());
  }, [dispatch]);

  const adminSettings = useMemo(() => {
    return Object.keys(adminSections).reduce<AdminSetting[]>((memo, key) => {
      const settings: AdminSetting[] = adminSections[key].settings || [];
      const path = `/admin/settings/${key}`;
      const acc: AdminSetting[] = [
        ...memo,
        ...settings
          .filter(s => s.display_name)
          .map(s => ({
            name: s.display_name || "",
            description: s.description,
            path,
            key: s.key,
            display_name: `${key[0].toUpperCase()}${key.slice(1)} / ${
              s.display_name
            }`,
          })),
      ];
      return acc;
    }, []);
  }, [adminSections]);

  const adminSettingsActions: PaletteAction[] = useMemo(() => {
    return adminSettings.map(s => ({
      parent: "admin_settings",
      id: s.display_name,
      name: s.display_name,
      icon: <Icon name="gear" />,
      perform: () => {
        dispatch(
          push({
            pathname: s.path,
            hash: `#${s.key}`,
          }),
        );
      },
    }));
  }, [adminSettings, dispatch]);

  const {
    data: searchResults,
    error: searchError,
    isLoading: isSearchLoading,
  } = useSearchListQuery<SearchResult>({
    enabled: debouncedSearchText.length > 0,
    query: { q: debouncedSearchText, limit: DEFAULT_SEARCH_LIMIT },
    reload: true,
  });

  const basicActions = useMemo<PaletteAction[]>(() => {
    const ret: PaletteAction[] = [
      {
        id: "search_docs",
        name: `Search documentation for “${query}”`,
        component: query
          ? // TODO: Why use these classNames here?
            jt`${(
              <span className="truncate max-w-md dark:text-white">
                Search documentation for&nbsp;
                <strong>&ldquo;{query}&rdquo;</strong>
              </span>
            )}`
          : t`View documentation`,
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

  const searchResultActions = useMemo<PaletteAction[]>(() => {
    const ret: PaletteAction[] = [];
    if (isSearchLoading) {
      ret.push({
        id: "search-is-loading",
        name: "Loading...",
        keywords: query,
        component: <Loader size="sm" />,
        section: "Search results",
      });
    } else if (searchError) {
      ret.push({
        id: "search-error",
        name: t`Could not load search results`,
        section: "Search results",
      });
    } else if (debouncedSearchText) {
      if (searchResults?.length) {
        ret.push(
          ...searchResults.map(result => {
            const wrappedResult = Search.wrapEntity(result, dispatch);
            return {
              id: `search-result-${result.id}`,
              name: result.name,
              icon: <Icon {...wrappedResult.getIcon()} />,
              section: "Search results",
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
          section: "Search results",
          isButton: false,
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

  return [...basicActions, ...searchResultActions, ...adminSettingsActions];
};
