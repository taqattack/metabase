import type { Action, ActionImpl } from "kbar";
import {
  KBarPortal,
  KBarProvider,
  KBarResults,
  useKBar,
  useMatches,
  useRegisterActions,
} from "kbar";
import { useCallback, useState, type ReactNode } from "react";
import { push } from "react-router-redux";
import { useDebounce } from "react-use";
import { t } from "ttag";
import _ from "underscore";

import { color } from "metabase/lib/colors";
import { SEARCH_DEBOUNCE_DURATION } from "metabase/lib/constants";
import { useDispatch, useSelector } from "metabase/lib/redux";
import * as Urls from "metabase/lib/urls";
import { closeModal, setOpenModal } from "metabase/redux/ui";
import { getUserIsAdmin } from "metabase/selectors/user";
import { Flex, Icon, Modal, Text, Box } from "metabase/ui";

import { useCommandPalette } from "../hooks/useCommandPalette";

import {
  PaletteFooterContainer,
  PaletteInput,
  PaletteResult,
  PaletteResultList,
  PaletteResultsSectionHeader,
} from "./Palette.styled";

// TODO: Maybe scroll to the selected item in the palette when it's out of sight

const PaletteFooter = () => {
  return (
    <PaletteFooterContainer p=".5rem 1.5rem" gap="1.5rem">
      <Flex gap=".33rem">
        <Icon color={color("text-light")} name="sort" />
        <Text tt="uppercase" weight="bold" size="10px" color={color("medium")}>
          Select
        </Text>
      </Flex>
      <Flex gap=".33rem">
        <EnterIcon />
        <Text tt="uppercase" weight="bold" size="10px" color={color("medium")}>
          Open
        </Text>
      </Flex>
    </PaletteFooterContainer>
  );
};

const EnterIcon = ({
  fill = color("text-light"),
  active = true,
}: {
  fill?: string;
  active?: boolean;
}) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ visibility: active ? "visible" : "hidden" }}
  >
    <path
      d="M3.03377 10.25H4.10128H12C12.6904 10.25 13.25 9.69036 13.25 9V5C13.25 4.30964 12.6904 3.75 12 3.75H9.4C9.26193 3.75 9.15 3.86193 9.15 4C9.15 4.13807 9.26193 4.25 9.4 4.25H12C12.4143 4.25 12.75 4.58583 12.75 5V9C12.75 9.41417 12.4143 9.75 12 9.75H4.10128H3.03375L3.71717 8.92991L5.19205 7.16005C5.19205 7.16005 5.19206 7.16005 5.19206 7.16005C5.28045 7.05397 5.26611 6.89634 5.16005 6.80795L5.16004 6.80795C5.05398 6.71956 4.89634 6.73388 4.80794 6.83995L3.03377 10.25ZM3.03377 10.25L3.71716 11.0701L5.19205 12.84L5.19206 12.84C5.28043 12.946 5.26613 13.1037 5.16003 13.1921C5.05396 13.2804 4.89633 13.2661 4.80794 13.16C4.80794 13.16 4.80793 13.16 4.80793 13.16L2.30794 10.16L2.30792 10.16C2.23071 10.0673 2.23067 9.93269 2.30794 9.83995C2.30794 9.83995 2.30794 9.83995 2.30795 9.83994L4.80793 6.83996L3.03377 10.25Z"
      fill={fill}
      stroke={fill}
    />
  </svg>
);

/** Command palette */
export const Palette = ({ children }: { children: ReactNode }) => {
  const dispatch = useDispatch();
  const isAdmin = useSelector(getUserIsAdmin);

  const openNewModal = useCallback(
    (modalId: string) => {
      dispatch(closeModal());
      dispatch(setOpenModal(modalId));
    },
    [dispatch],
  );

  const initialActions: Action[] = [
    {
      id: "new_collection",
      name: t`New collection`,
      icon: <Icon name="collection" />,
      perform: () => {
        openNewModal("collection");
      },
    },
    {
      id: "new_dashboard",
      name: t`New dashboard`,
      icon: <Icon name="dashboard" />,
      perform: () => {
        openNewModal("dashboard");
      },
    },
    {
      id: "new_question",
      name: t`New question`,
      icon: <Icon name="insight" />,
      perform: () => {
        dispatch(closeModal());
        dispatch(
          push(
            Urls.newQuestion({
              mode: "notebook",
              creationType: "custom_question",
            }),
          ),
        );
      },
    },
    {
      id: "new_query",
      name: t`New SQL query`,
      icon: <Icon name="sql" />,
      perform: () => {
        dispatch(closeModal());
        dispatch(
          push(
            Urls.newQuestion({
              type: "native",
              creationType: "native_question",
              cardType: "question",
            }),
          ),
        );
      },
    },
    {
      id: "new_model",
      name: t`New model`,
      icon: <Icon name="model" />,
      perform: () => {
        dispatch(closeModal());
        dispatch(push("model/new"));
      },
    },
    {
      id: "new_action",
      name: t`New action`,
      icon: <Icon name="bolt" />,
      perform: () => {
        openNewModal("action");
      },
    },
    {
      id: "navigate_data",
      name: t`Browse Data`,
      icon: <Icon name="database" />,
      perform: () => {
        dispatch(push("/browse"));
      },
    },
    {
      id: "navigate_databases",
      name: t`Browse Databases`,
      keywords: "db",
      icon: <Icon name="database" />,
      perform: () => {
        dispatch(push("/browse/databases"));
      },
    },
    {
      id: "navigate_models",
      name: t`Browse Models`,
      icon: <Icon name="model" />,
      perform: () => {
        dispatch(push("/browse/models"));
      },
    },
  ];

  if (isAdmin) {
    initialActions.push({
      id: "navigate_admin",
      name: t`Admin Settings`,
      icon: <Icon name="gear" />,
      perform: () => {
        dispatch(push("/admin"));
      },
    });
  }

  // Opening and closing is handled by KBar, so the modal is given an
  // empty function
  return (
    <KBarProvider actions={initialActions}>
      <KBarPortal>
        <Modal.Root opened onClose={() => {}} yOffset="10vh" centered={false}>
          <Modal.Overlay />
          <Modal.Content>
            <Box w="100%" p="1.5rem" pb="0">
              <PaletteInput defaultPlaceholder="Jump to..." />
            </Box>
            <PaletteResults />
            <PaletteFooter />
          </Modal.Content>
        </Modal.Root>
      </KBarPortal>
      {children}
    </KBarProvider>
  );
};

export const PaletteResults = () => {
  // Used for finding actions within the list
  const { search: query } = useKBar(state => ({ search: state.searchQuery }));
  const trimmedQuery = query.trim();

  // Used for finding objects across the Metabase instance
  const [debouncedSearchText, setDebouncedSearchText] = useState(trimmedQuery);

  useDebounce(
    () => {
      setDebouncedSearchText(trimmedQuery);
    },
    SEARCH_DEBOUNCE_DURATION,
    [trimmedQuery],
  );

  const actions = useCommandPalette({
    query: trimmedQuery,
    debouncedSearchText,
  });

  useRegisterActions(actions, actions);

  const { results } = useMatches();

  const processedResults = processResults(results);

  return (
    <PaletteResultList>
      <KBarResults
        items={processedResults}
        onRender={({
          item,
          active,
        }: {
          item: string | ActionImpl;
          active: boolean;
        }) => {
          return (
            <PaletteResult active={active}>
              {typeof item === "string" ? (
                <PaletteResultsSectionHeader>
                  {item}
                </PaletteResultsSectionHeader>
              ) : (
                <Flex
                  p=".75rem"
                  w="100%"
                  align="center"
                  justify="space-between"
                >
                  <Flex gap=".5rem">
                    {item.icon || <Icon name="click" />}
                    {item.name}
                  </Flex>
                  <EnterIcon active={active} fill={color("brand")} />
                </Flex>
              )}
            </PaletteResult>
          );
        }}
      />
    </PaletteResultList>
  );
};

const processResults = (results: (string | ActionImpl)[]) => {
  const groupedResults = _.groupBy(
    results.filter((r): r is ActionImpl => !(typeof r === "string")),
    "section",
  );

  const actions = processSection("Actions", groupedResults["undefined"]);
  const search = processSection("Search results", groupedResults["search"]);
  const recent = processSection("Recent items", groupedResults["recent"]);
  const admin = processSection("Admin", groupedResults["admin"]);
  const docs = groupedResults["docs"] || [];

  return [...admin, ...actions.slice(0, 6), ...search, ...recent, ...docs];
};

const processSection = (sectionName: string, items?: ActionImpl[]) => {
  if (items && items.length > 0) {
    return [sectionName, ...items];
  } else {
    return [];
  }
};
