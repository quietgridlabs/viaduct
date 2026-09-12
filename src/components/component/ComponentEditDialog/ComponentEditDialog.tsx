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
import ElementGroupField from "@components/common/ElementGroupField";
import ElementTagsField from "@components/common/ElementTagsField";
import ExternalField from "@components/common/ExternalField";
import ElementLinksField from '@components/common/ElementLinksField';
import DesignContractField from '@components/common/DesignContractField';
import TechnologySelect from "@components/TechnologySelect";
import usePanelValues from "@components/common/UsePanelValues";
import { useTranslation } from "react-i18next";

interface ComponentEditDialogProps {
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
  /* A component in a front end has a design; one in a service does not. The
     slot appears when this element already carries one, or when its container
     names a design system — elsewhere it would be a row that never fills. */
  showDesign?: boolean;
  /** The element being edited, so its own connections can be offered. */
  designElementId?: string;
  initialDesign?: string;
  /** Inherited from the container, for naming where the tokens come from. */
  designSystem?: string;
  onSave: (
    name: string,
    description: string,
    technology: string,
    url: string,
    links: ElementLink[],
    external: boolean,
    tags: string[],
    group: string,
    design: string
  ) => void;
  onClose: () => void;
  /** Read access only: the panel opens to be read, not filled in. */
  readOnly?: boolean;
  audit?: AuditExtras | null;
  /** Where this element lives, so the assistant can be offered. Absent: no offer. */
  assist?: AssistTargetRef | null;
}

interface ComponentValues {
  name: string;
  description: string;
  technology: string;
  url: string;
  links: ElementLink[];
  external: boolean;
  tags: string[];
  group: string;
  design: string;
}

export default function ComponentEditDialog({
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
  showDesign = false,
  designElementId,
  initialDesign = "",
  designSystem,
  onSave,
  onClose,
  readOnly = false,
  audit,
  assist = null,
}: ComponentEditDialogProps) {
  const [values, setValues] = usePanelValues<ComponentValues>(
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
      design: initialDesign || "",
    },
    assist?.ownerId
  );
  const { t } = useTranslation();

  const handleChange = (field: keyof ComponentValues, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <BaseEditDialog
      open={open}
      title={t("edit_component")}
      identity={panelIdentity(values.name, {
        technology: values.technology,
        onNameChange: (v) => handleChange("name", v),
        placeholder: t("component_name"),
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
          values.technology,
          values.url,
          values.links,
          values.external,
          values.tags,
          values.group,
          values.design
        )
      }
      onClose={onClose}
      readOnly={readOnly}
      audit={audit}
      saveDisabled={!values.name.trim()}
    >
      <TechnologySelect
        level="component"
        value={values.technology}
        onChange={(value) => handleChange("technology", value)}
        label={t("technology")}
        placeholder={t("select_technology")}
      />
      <ElementLinksField
        links={values.links}
        onChange={(links) => setValues((prev) => ({ ...prev, links }))}
      />
      {showDesign ? (
        <DesignContractField
          elementId={designElementId}
          value={values.design}
          designSystem={designSystem}
          readOnly={readOnly}
          onChange={(design) => setValues((prev) => ({ ...prev, design }))}
        />
      ) : null}
      <ExternalField
        checked={values.external}
        onChange={(checked) => handleChange("external", checked)}
      />
    </BaseEditDialog>
  );
}
