import AssistDescriptionField, { type AssistTargetRef } from '@components/common/AssistDescriptionField';
import { getElementLinks, type ElementLink } from '@/types/c4Extensions';
import BaseEditDialog from "@components/common/BaseEditDialog";
import { panelIdentity } from '@components/common/PanelIdentity';
import type { AuditExtras } from "@/types/c4Extensions";
import {
  clampElementDescription,
  normalizeGroup,
  sanitizeTags,
} from "@/types/c4Extensions";
import CodeEditor from "@components/common/CodeEditor";
import ElementGroupField from "@components/common/ElementGroupField";
import ElementTagsField from "@components/common/ElementTagsField";
import ThemedSelect from "@components/common/ThemedSelect";
import ElementLinksField from '@components/common/ElementLinksField';
import TechnologySelect from "@components/TechnologySelect";
import { Box } from "@chakra-ui/react";
import usePanelValues from "@components/common/UsePanelValues";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface CodeEditDialogProps {
  open: boolean;
  initialName?: string;
  initialDescription?: string;
  initialCodeType?: "class" | "function" | "interface" | "variable" | "other";
  initialLanguage?: string;
  initialCode?: string;
  initialUrl?: string;
  initialLinks?: ElementLink[];
  initialTags?: string[];
  availableTags?: string[];
  initialGroup?: string;
  availableGroups?: string[];
  onSave: (
    name: string,
    description: string,
    codeType: "class" | "function" | "interface" | "variable" | "other",
    technology: string,
    code: string,
    url: string,
    links: ElementLink[],
    tags: string[],
    group: string
  ) => void;
  onClose: () => void;
  /** Read access only: the panel opens to be read, not filled in. */
  readOnly?: boolean;
  audit?: AuditExtras | null;
  /** Where this element lives, so the assistant can be offered. Absent: no offer. */
  assist?: AssistTargetRef | null;
}

type CodeType = "class" | "function" | "interface" | "variable" | "other";

interface CodeValues {
  name: string;
  description: string;
  codeType: CodeType;
  technology: string;
  code: string;
  url: string;
  links: ElementLink[];
  tags: string[];
  group: string;
}

export default function CodeEditDialog({
  open,
  initialName = "",
  initialDescription = "",
  initialCodeType = "class",
  initialLanguage = "",
  initialCode = "",
  initialUrl = "",
  initialLinks = [],
  initialTags = [],
  availableTags = [],
  initialGroup = "",
  availableGroups = [],
  onSave,
  onClose,
  readOnly = false,
  audit,
  assist = null,
}: CodeEditDialogProps) {
  const [values, setValues] = usePanelValues<CodeValues>(
    open,
    {
      name: initialName,
      description: clampElementDescription(initialDescription),
      codeType: initialCodeType,
      technology: initialLanguage || "",
      code: initialCode || "",
      url: initialUrl || "",
      links: getElementLinks({ links: initialLinks, url: initialUrl }),
      tags: sanitizeTags(initialTags),
      group: normalizeGroup(initialGroup),
    },
    assist?.ownerId
  );
  const { t } = useTranslation();

  const codeTypeOptions = useMemo(
    () => [
      { value: "class", label: t("code_type_class") },
      { value: "function", label: t("code_type_function") },
      { value: "interface", label: t("code_type_interface") },
      { value: "variable", label: t("code_type_variable") },
      { value: "other", label: t("code_type_other") },
    ],
    [t]
  );

  const handleChange = (field: keyof CodeValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <BaseEditDialog
      open={open}
      title={t("edit_code_element")}
      identity={panelIdentity(values.name, {
        technology: values.technology,
        onNameChange: (v) => handleChange("name", v),
        placeholder: t("code_name"),
      })}
      intro={
        <AssistDescriptionField
          key={assist?.ownerId ?? 'no-assist'}
          value={values.description}
          onChange={(e) => handleChange("description", e.target.value)}
          assist={assist}
          readOnly={readOnly}
        />
      }
      tagsAndGroup={
        <>
          <ElementTagsField
            tags={values.tags}
            catalog={availableTags}
            onChange={(tags) => setValues((prev) => ({ ...prev, tags }))}
          />
          <ElementGroupField
            group={values.group}
            catalog={availableGroups}
            onChange={(group) => setValues((prev) => ({ ...prev, group }))}
          />
        </>
      }
      onSave={() =>
        onSave(
          values.name,
          values.description,
          values.codeType,
          values.technology,
          values.code,
          values.url,
          values.links,
          values.tags,
          values.group
        )
      }
      onClose={onClose}
      readOnly={readOnly}
      audit={audit}
      saveDisabled={!values.name.trim()}
    >
      <Box display="flex" gap="16px" alignItems="flex-start" w="full">
        <Box flex="1 1 0" minW={0}>
          <ThemedSelect
            width="100%"
            label={t("code_type")}
            value={values.codeType}
            onChange={(v) => handleChange("codeType", v as CodeType)}
            options={codeTypeOptions}
            data-testid="input_type"
          />
        </Box>
        <Box flex="1 1 0" minW={0}>
          <TechnologySelect
            fullWidth
            level="code"
            value={values.technology}
            onChange={(value) => handleChange("technology", value)}
            label={t("language")}
            placeholder={t("select_language")}
          />
        </Box>
      </Box>
      <CodeEditor
        label={t("code")}
        value={values.code}
        onChange={(value) => handleChange("code", value)}
        language={values.technology}
        placeholder={t("code_placeholder")}
      />
      <ElementLinksField
        links={values.links}
        onChange={(links) => setValues((prev) => ({ ...prev, links }))}
      />
    </BaseEditDialog>
  );
}
