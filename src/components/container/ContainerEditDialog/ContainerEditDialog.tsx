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
import FlowParticipationList from "@components/data-flow/FlowParticipationList";
import ElementLinksField from '@components/common/ElementLinksField';
import TechnologySelect from "@components/TechnologySelect";
import DesignSystemField, {
  type DesignSystemChoice,
} from "@components/common/DesignSystemField";
import type { Domain } from "@/types/c4Extensions";
import type { DataFlowParticipation } from "@utils/dataFlows";
import usePanelValues from "@components/common/UsePanelValues";
import { useTranslation } from "react-i18next";
import { Box, Text } from "@chakra-ui/react";

interface ContainerEditDialogProps {
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
  /** Front ends only — a broker or a database is never asked. */
  designAvailable?: boolean;
  /** Which design system this front end is built in; everything inside inherits it. */
  initialDesignSystem?: string;
  /** The systems already named elsewhere in this project — reuse over invention. */
  availableDesignSystems?: DesignSystemChoice[];
  onSave: (
    name: string,
    description: string,
    technology: string,
    url: string,
    links: ElementLink[],
    external: boolean,
    tags: string[],
    group: string,
    domainId: string,
    designSystem: string
  ) => void;
  onClose: () => void;
  /** Read access only: the panel opens to be read, not filled in. */
  readOnly?: boolean;
  audit?: AuditExtras | null;
  /** Where this element lives, so the assistant can be offered. Absent: no offer. */
  assist?: AssistTargetRef | null;
  flowParticipations?: DataFlowParticipation[];
  onOpenFlowStep?: (flowId: string, stepId: string) => void;
}

interface ContainerValues {
  name: string;
  description: string;
  technology: string;
  url: string;
  links: ElementLink[];
  external: boolean;
  tags: string[];
  group: string;
  domainId: string;
  designSystem: string;
}

export default function ContainerEditDialog({
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
  designAvailable = false,
  initialDesignSystem = "",
  availableDesignSystems = [],
  onSave,
  onClose,
  readOnly = false,
  audit,
  assist = null,
  flowParticipations = [],
  onOpenFlowStep,
}: ContainerEditDialogProps) {
  const [values, setValues] = usePanelValues<ContainerValues>(
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
      designSystem: initialDesignSystem || "",
    },
    assist?.ownerId
  );
  const { t } = useTranslation();

  const handleChange = (field: keyof ContainerValues, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <BaseEditDialog
      open={open}
      title={t("edit_container")}
      identity={panelIdentity(values.name, {
        technology: values.technology,
        onNameChange: (v) => handleChange("name", v),
        placeholder: t("container_name"),
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
          values.domainId,
          values.designSystem
        )
      }
      onClose={onClose}
      readOnly={readOnly}
      audit={audit}
      saveDisabled={!values.name.trim()}
    >
      <TechnologySelect
        level="container"
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
      {/* Where the design system is chosen: on the deployable, because two
          front ends in one project can be built in two different ones. */}
      {designAvailable ? (
        <DesignSystemField
          value={values.designSystem}
          catalog={availableDesignSystems}
          onChange={(designSystem) => setValues((prev) => ({ ...prev, designSystem }))}
        />
      ) : null}
      <ElementDomainField
        domainId={values.domainId}
        domains={availableDomains}
        onChange={(domainId) => setValues((prev) => ({ ...prev, domainId }))}
      />
      {onOpenFlowStep ? (
        <Box mt="8px">
          <Text fontSize="sm" fontWeight="700" mb="6px">
            {t("data_flow_on_service", { count: new Set(flowParticipations.map((p) => p.flow.id)).size })}
          </Text>
          <FlowParticipationList
            participations={flowParticipations}
            onOpenStep={onOpenFlowStep}
          />
        </Box>
      ) : null}
    </BaseEditDialog>
  );
}
