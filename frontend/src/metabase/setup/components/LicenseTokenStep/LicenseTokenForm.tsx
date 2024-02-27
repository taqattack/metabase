import { useState } from "react";
import { t } from "ttag";

import { SetupApi } from "metabase/services";
import { Box, Button, Text, TextInput } from "metabase/ui";

type LicenseTokenFormProps = {
  onValidSubmit: (token: string) => void;
};

export const LicenseTokenForm = ({ onValidSubmit }: LicenseTokenFormProps) => {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "invalid_token" | "unable_to_validate"
  >("idle");

  const isInputCorrectLength = token.length === 64;

  const submit = async () => {
    setStatus("loading");
    try {
      const response = await SetupApi.validate_token({ token });
      if (response.valid) {
        setStatus("success");
        onValidSubmit(token);
      } else if (response.error_code === "unable_to_validate") {
        setStatus("unable_to_validate");
      } else {
        setStatus("invalid_token");
      }
    } catch (e) {
      setStatus("unable_to_validate");
    }
  };

  return (
    <>
      <Box mb="md">
        <TextInput
          aria-label={t`Token`}
          placeholder={t`Paste your token here`}
          value={token}
          onChange={e => setToken(e.target.value)}
          error={["invalid_token", "unable_to_validate"].includes(status)}
        />
        {status === "invalid_token" && (
          <Text color="error">{t`This token doesn’t seem to be valid. Double-check it, then contact support if you think it should be working`}</Text>
        )}
        {status === "unable_to_validate" && (
          <>
            <Text color="error">{t`We couldn’t connect to our servers to activate the license. Please try again.`}</Text>
            <Text color="error">{t`You can also set this up at a later time in settings.`}</Text>
          </>
        )}
      </Box>
      <Button
        variant={isInputCorrectLength ? "filled" : "default"}
        loading={status === "loading"}
        onClick={submit}
      >{t`Activate`}</Button>
    </>
  );
};
