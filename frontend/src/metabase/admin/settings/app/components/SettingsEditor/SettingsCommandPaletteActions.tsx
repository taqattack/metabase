import { useRegisterActions, type Action } from "kbar";
import { useMemo } from "react";
import { push } from "react-router-redux";
import { t } from "ttag";

import { useDispatch } from "metabase/lib/redux";
import { Icon } from "metabase/ui";

type AdminSetting = {
  key: string;
  display_name: string;
  description: string | null;
  type?: "string";
  path: string;
};

export const SettingsCommandPaletteActions = ({
  sections,
}: {
  sections: any;
}) => {
  const dispatch = useDispatch();

  const adminSettingsActions = useMemo(() => {
    return Object.keys(sections).reduce<Action[]>(
      (memo, key) => {
        const settings: AdminSetting[] = sections[key].settings || [];
        const path = `/admin/settings/${key}`;
        const acc: Action[] = [
          ...memo,
          ...settings
            .filter(s => s.display_name)
            .map(s => ({
              name: s.display_name || "",
              section: "admin",
              id: `admin-${s.key}`,
              perform: () => {
                dispatch(
                  push({
                    pathname: path,
                    hash: `#${s.key}`,
                  }),
                );
              },
              icon: <Icon name="link" />,
            })),
        ];
        return acc;
      },
      [
        {
          name: t`Back`,
          section: "admin",
          id: `admin-back`,
          perform: () => {
            dispatch(push("/"));
          },
          icon: <Icon name="arrow_left" />,
        },
      ],
    );
  }, [sections, dispatch]);

  useRegisterActions(adminSettingsActions, [adminSettingsActions]);

  return null;
};
