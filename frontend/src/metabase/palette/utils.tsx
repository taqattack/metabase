import { uuid } from "metabase/lib/utils";
import { Icon } from "metabase/ui";
import type { IconName } from "metabase/ui";
import type { PaletteAction } from "./hooks/useCommandPalette";

export const createPaletteAction = ({
  component,
  icon = "click",
  perform,
}: {
  component: React.ReactNode;
  icon: React.ReactNode | IconName;
  perform: () => void;
}): PaletteAction => ({
  id: uuid(),
  name: component?.toString() || "",
  component,
  icon:
    typeof icon === "string" ? <Icon name={icon as IconName} /> : <>{icon}</>,
  perform,
});
