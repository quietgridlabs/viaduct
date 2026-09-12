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
import ElementDomainField from "@components/common/ElementDomainField";
import ElementGroupField from "@components/common/ElementGroupField";
import ElementTagsField from "@components/common/ElementTagsField";
import ExternalField from "@components/common/ExternalField";
import ElementLinksField from '@components/common/ElementLinksField';
import TechnologySelect from "@components/TechnologySelect";
import type { Domain } from "@/types/c4Extensions";
import usePanelValues from "@components/common/UsePanelValues";
import { useTranslation } from "react-i18next";

interface SystemEditDialogProps {
  open: boolean;
  initialName?: string;
  initialDescription?: string;
  initialTechnology?: string;
  initialUrl?: string;
  initialLinks?: ElementLink[];
  initialExternal?: boolean;
  initialTags?: string[];
  availableTags?: string[];
  initialGroup?: string;
  availableGroups?: string[];
  initialDomainId?: string;
  availableDomains?: Domain[];
  onSave: (
    name: string,
    description: string,
    technology: string,
    url: string,
    links: ElementLink[],
    external: boolean,
    tags: string[],
    group: string,
    domainId: string
  ) => void;
  onClose: () => void;
  /** Read access only: the panel opens to be read, not filled in. */
  readOnly?: boolean;
  audit?: AuditExtras | null;
  /** Where this element lives, so the assistant can be offered. Absent: no offer. */
  assist?: AssistTargetRef | null;
}

interface SystemValues {
  name: string;
  description: string;
  technology: string;
  url: string;
  links: ElementLink[];
  external: boolean;
  tags: string[];
  group: string;
  domainId: string;
}

export default function SystemEditDialog({
  open,
  initialName = "",
  initialDescription = "",
  initialTechnology = "",
  initialUrl = "",
  initialLinks = [],
  initialExternal = false,
  initialTags = [],
  availableTags = [],
  initialGroup = "",
  availableGroups = [],
  initialDomainId = "",
  availableDomains = [],
  onSave,
  onClose,
  readOnly = false,
  audit,
  assist = null,
}: SystemEditDialogProps) {
  const [values, setValues] = usePanelValues<SystemValues>(
    open,
    {
      name: initialName,
      description: clampElementDescription(initialDescription),
      technology: initialTechnology || "",
      url: initialUrl || "",
      links: getElementLinks({ links: initialLinks, url: initialUrl }),
      external: initialExternal,
      tags: sanitizeTags(initialTags),
      group: normalizeGroup(initialGroup),
      domainId: initialDomainId || "",
    },
    assist?.ownerId
  );
  const { t } = useTranslation();

  const handleChange = (field: keyof SystemValues, value: string | boolean) => {
    setValues((prev) => ({
      ...prev,
      [field]:
        field === "description" && typeof value === "string"
          ? clampElementDescription(value)
          : value,
    }));
  };

  const handleSave = () =>
    onSave(
      values.name,
      values.description,
      values.technology,
      values.url,
      values.links,
      values.external,
      values.tags,
      values.group,
      values.domainId
    );

  const isValid = !!values.name.trim();

  return (
    <BaseEditDialog
      open={open}
      title={t("edit_system")}
      identity={panelIdentity(values.name, {
        technology: values.technology,
        onNameChange: (v) => handleChange("name", v),
        placeholder: t("system_name"),
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
      onSave={handleSave}
      onClose={onClose}
      readOnly={readOnly}
      audit={audit}
      saveDisabled={!isValid}
    >
      <TechnologySelect
        level="system"
        value={values.technology}
        onChange={(value) => handleChange("technology", value)}
        label={t("technology")}
        placeholder={t("select_technology")}
      />
      <ElementLinksField
        links={values.links}
        onChange={(links) => setValues((prev) => ({ ...prev, links }))}
      />
      <ExternalField
        checked={values.external}
        onChange={(checked) => handleChange("external", checked)}
      />
      <ElementDomainField
        domainId={values.domainId}
        domains={availableDomains}
        onChange={(domainId) => setValues((prev) => ({ ...prev, domainId }))}
      />
    </BaseEditDialog>
  );
}
