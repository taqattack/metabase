import { useState } from "react";

import { Box, Flex } from "metabase/ui";
import * as Lib from "metabase-lib";

import { JoinConditionColumnPicker } from "../JoinConditionColumnPicker";
import { JoinConditionOperatorPicker } from "../JoinConditionOperatorPicker";
import { JoinConditionRemoveButton } from "../JoinConditionRemoveButton";

import { JoinConditionRoot } from "./JoinConditionDraft.styled";
import { getDefaultJoinConditionOperator } from "./utils";

interface JoinConditionDraftProps {
  query: Lib.Query;
  stageIndex: number;
  table: Lib.Joinable;
  isReadOnly: boolean;
  isRemovable: boolean;
  onChange: (newCondition: Lib.JoinCondition) => void;
  onRemove?: () => void;
  onLhsColumnChange?: (newLhsColumn: Lib.ColumnMetadata) => void;
}

export function JoinConditionDraft({
  query,
  stageIndex,
  table,
  isReadOnly,
  isRemovable,
  onChange,
  onRemove,
  onLhsColumnChange,
}: JoinConditionDraftProps) {
  const [operator, setOperator] = useState(() =>
    getDefaultJoinConditionOperator(query, stageIndex),
  );
  const [lhsColumn, setLhsColumn] = useState<Lib.ColumnMetadata>();
  const [rhsColumn, setRhsColumn] = useState<Lib.ColumnMetadata>();
  const [isLhsOpened, setIsLhsOpened] = useState(true);
  const [isRhsOpened, setIsRhsOpened] = useState(false);

  const handleColumnChange = (
    lhsColumn: Lib.ColumnMetadata | undefined,
    rhsColumn: Lib.ColumnMetadata | undefined,
  ) => {
    if (lhsColumn != null && rhsColumn != null) {
      const newCondition = Lib.joinConditionClause(
        query,
        stageIndex,
        operator,
        lhsColumn,
        rhsColumn,
      );
      onChange(newCondition);
    }
  };

  const handleLhsColumnChange = (newLhsColumn: Lib.ColumnMetadata) => {
    setLhsColumn(newLhsColumn);
    setIsRhsOpened(true);
    onLhsColumnChange?.(newLhsColumn);
    handleColumnChange(newLhsColumn, rhsColumn);
  };

  const handleRhsColumnChange = (newRhsColumn: Lib.ColumnMetadata) => {
    setRhsColumn(newRhsColumn);
    handleColumnChange(lhsColumn, newRhsColumn);
  };

  return (
    <JoinConditionRoot>
      <Flex align="center" gap="xs" mih="47px" p="xs">
        <Box ml={!lhsColumn ? "xs" : undefined}>
          <JoinConditionColumnPicker
            query={query}
            stageIndex={stageIndex}
            joinable={table}
            lhsColumn={lhsColumn}
            rhsColumn={rhsColumn}
            isOpened={isLhsOpened}
            isLhsColumn={true}
            isReadOnly={isReadOnly}
            onChange={handleLhsColumnChange}
            onOpenChange={setIsLhsOpened}
          />
        </Box>
        <JoinConditionOperatorPicker
          query={query}
          stageIndex={stageIndex}
          operator={operator}
          isReadOnly={isReadOnly}
          isConditionComplete={false}
          onChange={setOperator}
        />
        <Box mr={!rhsColumn ? "xs" : undefined}>
          <JoinConditionColumnPicker
            query={query}
            stageIndex={stageIndex}
            joinable={table}
            lhsColumn={lhsColumn}
            rhsColumn={rhsColumn}
            isOpened={isRhsOpened}
            isLhsColumn={false}
            isReadOnly={isReadOnly}
            onChange={handleRhsColumnChange}
            onOpenChange={setIsRhsOpened}
          />
        </Box>
      </Flex>
      {isRemovable && (
        <JoinConditionRemoveButton
          isConditionComplete={false}
          onClick={onRemove}
        />
      )}
    </JoinConditionRoot>
  );
}
