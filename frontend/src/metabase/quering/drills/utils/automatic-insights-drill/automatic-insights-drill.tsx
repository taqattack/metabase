import { t } from "ttag";
import { ClickActionsView } from "metabase/visualizations/components/ClickActions";
import type {
  RegularClickAction,
  ClickActionPopoverProps,
  Drill,
} from "metabase/visualizations/types/click-actions";
import {
  getAutomaticDashboardUrl,
  getComparisonDashboardUrl,
} from "metabase-lib/urls";

export const automaticInsightsDrill: Drill = ({ drill, applyDrill }) => {
  const actions: RegularClickAction[] = [
    {
      name: "exploratory-dashboard",
      title: t`X-ray`,
      section: "auto-popover",
      icon: "bolt",
      buttonType: "horizontal",
      url: () => getAutomaticDashboardUrl(applyDrill(drill)),
    },
    {
      name: "compare-dashboard",
      title: t`Compare to the rest`,
      section: "auto-popover",
      icon: "segment",
      buttonType: "horizontal",
      url: () => getComparisonDashboardUrl(applyDrill(drill)),
    },
  ];

  const DrillPopover = ({ onClick }: ClickActionPopoverProps) => {
    return <ClickActionsView clickActions={actions} onClick={onClick} />;
  };

  return [
    {
      name: "automatic-insights",
      title: t`Automatic insights…`,
      section: "auto",
      icon: "bolt",
      buttonType: "horizontal",
      popover: DrillPopover,
    },
  ];
};