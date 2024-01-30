import { useState, useCallback, useMemo } from "react";
import { t } from "ttag";

import { Modal } from "metabase/ui";
import ErrorBoundary from "metabase/ErrorBoundary";
import type { SearchResult } from "metabase-types/api";
import { useModalOpen } from "metabase/hooks/use-modal-open";

import type { EntityPickerOptions } from "../../types";
import { tabOptions, type ValidTab } from "../../utils";
import { EntityPickerSearchInput } from "../EntityPickerSearch/EntityPickerSearch";

import { NewCollectionDialog } from "./NewCollectionDialog";
import { ButtonBar } from "./ButtonBar";
import { TabsView } from "./TabsView";
import { SinglePickerView } from "./SinglePickerView";
import { GrowFlex, ModalContent, ModalBody } from "./EntityPickerModal.styled";

export type EntityPickerModalOptions = {
  showPersonalCollection?: boolean;
  showRootCollection?: boolean;
  showSearch?: boolean;
  hasConfirmButtons?: boolean;
  allowCreateNew?: boolean;
};

const defaultOptions: EntityPickerModalOptions = {
  showPersonalCollection: true,
  showRootCollection: true,
  showSearch: true,
  hasConfirmButtons: true,
  allowCreateNew: true,
};

interface EntityPickerModalProps {
  title: string;
  value?: Partial<SearchResult>;
  onChange: (item: SearchResult) => void;
  onClose: () => void;
  tabs: ValidTab[];
  options?: EntityPickerOptions;
}

export function EntityPickerModal({
  title = t`Choose an item`,
  onChange,
  onClose,
  tabs,
  value,
  options = defaultOptions,
}: EntityPickerModalProps) {
  const validTabs = useMemo(
    () => tabs.filter(tabName => tabName in tabOptions),
    [tabs],
  );
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null,
  );

  const { open } = useModalOpen();

  const handleItemSelect = useCallback(
    (item: SearchResult) => {
      options.hasConfirmButtons ? setSelectedItem(item) : onChange(item);
    },
    [onChange, options],
  );

  const handleConfirm = () => {
    if (selectedItem) {
      onChange(selectedItem);
    }
  };

  const hasTabs = validTabs.length > 1 || searchQuery;

  return (
    <Modal.Root opened={open} onClose={onClose}>
      <Modal.Overlay />
      <ModalContent h="100%">
        <Modal.Header px="2rem" pt="1rem" pb={hasTabs ? "1rem" : "1.5rem"}>
          <GrowFlex justify="space-between">
            <Modal.Title lh="2.5rem">{title}</Modal.Title>
            {options.showSearch && (
              <EntityPickerSearchInput
                models={validTabs}
                setSearchResults={setSearchResults}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
          </GrowFlex>
          <Modal.CloseButton />
        </Modal.Header>
        <ModalBody p="0">
          <ErrorBoundary>
            {hasTabs ? (
              <TabsView
                tabs={validTabs}
                onItemSelect={handleItemSelect}
                value={value}
                searchQuery={searchQuery}
                searchResults={searchResults}
                options={options}
                selectedItem={selectedItem}
              />
            ) : (
              <SinglePickerView
                model={tabs[0]}
                onItemSelect={handleItemSelect}
                value={value}
                options={options}
              />
            )}
            {!!options.hasConfirmButtons && (
              <ButtonBar
                onConfirm={handleConfirm}
                onCancel={onClose}
                canConfirm={!!selectedItem && selectedItem?.can_write !== false}
                allowCreateNew={options.allowCreateNew}
                currentCollection={selectedItem}
                onCreateNew={() => setCreateDialogOpen(true)}
              />
            )}
          </ErrorBoundary>
        </ModalBody>
        <NewCollectionDialog
          isOpen={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          parentCollection={selectedItem}
        />
      </ModalContent>
    </Modal.Root>
  );
}