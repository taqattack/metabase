import styled from "@emotion/styled";
import { KBarSearch } from "kbar";
import { color } from "metabase/lib/colors";
import { Button, Flex, Icon } from "metabase/ui";

export const PaletteResult = styled.div<{ active?: boolean }>`
  display: flex;
  background-color: ${props =>
    props.active ? color("brand-light") : "transparent"};
  color: ${props => (props.active ? color("brand") : color("text-medium"))};
  border-radius: 0.5rem;
  cursor: ${props => (props.active ? "pointer" : "default")};
  width: 100%;
  font-weight: bold;
  line-height: 1rem;
`;

export const PaletteResultIcon = styled(Icon)`
  margin-right: 0.5rem;
`;

export const PaletteResultButton = styled(Button)`
  // fix later
`;

export const PaletteResultList = styled.ul`
  flex: 1;
  display: flex;
  align-items: stretch;
  flex-flow: column nowrap;
  padding: 0.75rem 1.5rem;
  // hacky fix
  & > div {
    height: 100%;
    //max-height: unset;
  }
`;

export const PaletteModalContainer = styled.div`
  display: flex;
  flex-flow: column nowrap;
  flex: 1;
`;

export const PaletteInput = styled(KBarSearch)`
  padding: 0.5rem;
  font-weight: bold;
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid ${color("border")};
  background: ${color("bg-light")};
  color: ${color("text-dark")};

  &:focus {
    outline: none;
  }
`;

export const PaletteResultsSectionHeader = styled.div`
  text-transform: uppercase;
  font-weight: bold;
  font-size: 10px;
  padding: 0.5rem;
`;

export const PaletteFooterContainer = styled(Flex)`
  border-top: 1px solid ${color("border")};
`;
