import { t } from "ttag";

import { useMemo } from "react";
import EntityMenu from "metabase/components/EntityMenu";
import { DashboardHeaderButton } from "metabase/dashboard/components/DashboardHeader/DashboardHeader.styled";
import { Icon } from "metabase/ui";

import { IconContainer } from "./TextOptionsButton.styled";

interface TextOptionsButtonProps {
  onAddMarkdown: () => void;
  onAddHeading: () => void;
}

export function TextOptionsButton({
  onAddMarkdown,
  onAddHeading,
}: TextOptionsButtonProps) {
  const textOptions = useMemo(
    () => [
      {
        title: t`Heading`,
        paletteLabel: t`Add heading`,
        action: onAddHeading,
        event: "Dashboard; Add Heading",
      },
      {
        title: t`Text`,
        paletteLabel: t`Add text`,
        action: onAddMarkdown,
        event: "Dashboard; Add Markdown Box",
      },
    ],
    [onAddHeading, onAddMarkdown],
  );

  return (
    <EntityMenu
      items={textOptions}
      trigger={
        <DashboardHeaderButton aria-label={t`Add a heading or text box`}>
          <IconContainer>
            <Icon name="string" size={18} />
            <Icon name="chevrondown" size={10} />
          </IconContainer>
        </DashboardHeaderButton>
      }
      minWidth={90}
    />
  );
}
