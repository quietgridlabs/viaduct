import BaseEditDialog from '@components/common/BaseEditDialog';
import { panelIdentity } from '@components/common/PanelIdentity';
import ElementGroupField from '@components/common/ElementGroupField';
import ElementTagsField from '@components/common/ElementTagsField';
import HttpContractField from '@components/common/HttpContractField';
import ProtobufContractField from '@components/common/ProtobufContractField';
import ThemedSelect from '@components/common/ThemedSelect';
import ThemedTextField from '@components/common/ThemedTextField';
import {
  ELEMENT_DESCRIPTION_MAX,
  ENDPOINT_METHODS,
  clampElementDescription,
  isGrpcMethod,
  isWebSocketMethod,
  normalizeGroup,
  sanitizeTags,
  type AuditExtras,
  type EndpointMethod,
} from '@/types/c4Extensions';
import usePanelValues from '@components/common/UsePanelValues';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export type EndpointEditDialogProps = {
  open: boolean;
  initialName?: string;
  initialDescription?: string;
  initialEndpoint?: string;
  initialMethod?: string;
  initialRequest?: string;
  initialResponse?: string;
  initialHeaders?: string;
  initialTags?: string[];
  availableTags?: string[];
  initialGroup?: string;
  availableGroups?: string[];
  onSave: (values: {
    name: string;
    description: string;
    endpoint: string;
    method: EndpointMethod;
    request: string;
    response: string;
    headers: string;
    tags: string[];
    group: string;
  }) => void;
  onClose: () => void;
  /** Read access only: the panel opens to be read, not filled in. */
  readOnly?: boolean;
  audit?: AuditExtras | null;
};

type EndpointValues = {
  name: string;
  description: string;
  endpoint: string;
  method: EndpointMethod;
  request: string;
  response: string;
  tags: string[];
  group: string;
};

export default function EndpointEditDialog({
  open,
  initialName = '',
  initialDescription = '',
  initialEndpoint = '/',
  initialMethod = 'GET',
  initialRequest = '',
  initialResponse = '',
  initialHeaders = '',
  initialTags = [],
  availableTags = [],
  initialGroup = '',
  availableGroups = [],
  onSave,
  onClose,
  readOnly = false,
  audit,
}: EndpointEditDialogProps) {
  const { t } = useTranslation();

  const [values, setValues] = usePanelValues<EndpointValues>(open, {
    name: initialName,
    description: clampElementDescription(initialDescription),
    endpoint: initialEndpoint || '/',
    method: (ENDPOINT_METHODS.includes(initialMethod as EndpointMethod)
      ? initialMethod
      : 'GET') as EndpointMethod,
    request: initialRequest || '',
    response: initialResponse || '',
    tags: sanitizeTags(initialTags),
    group: normalizeGroup(initialGroup),
  });
  const { name, description, endpoint, method, request, response, tags, group } = values;
  const handleChange = <K extends keyof EndpointValues>(field: K, value: EndpointValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const methodOptions = useMemo(
    () =>
      ENDPOINT_METHODS.map((m) => ({
        value: m,
        label: m,
        /* WebSocket / gRPC are different kinds of call, not one more verb —
           the group keeps them from hiding at the end of the verb list. */
        group: isWebSocketMethod(m)
          ? t('endpoint_method_websocket')
          : isGrpcMethod(m)
            ? t('endpoint_method_grpc')
            : t('endpoint_method_http'),
      })),
    [t]
  );

  const grpc = isGrpcMethod(method);
  const websocket = isWebSocketMethod(method);

  return (
    <BaseEditDialog
      open={open}
      title={t('edit_endpoint')}
      identity={panelIdentity(name, {
        meta: method,
        onNameChange: (v) => handleChange('name', v),
        placeholder: t('endpoint_name'),
      })}
      intro={
        <ThemedTextField
          margin="dense"
          label={t('element_description')}
          fullWidth
          multiline
          minRows={2}
          maxLength={ELEMENT_DESCRIPTION_MAX}
          value={description}
          onChange={(e) => handleChange('description', e.target.value)}
          data-testid="input_endpoint_description"
        />
      }
      tagsAndGroup={
        <>
          <ElementTagsField
            tags={tags}
            catalog={availableTags}
            onChange={(v) => handleChange('tags', v)}
          />
          <ElementGroupField
            group={group}
            catalog={availableGroups}
            onChange={(v) => handleChange('group', v)}
          />
        </>
      }
      onClose={onClose}
      readOnly={readOnly}
      audit={audit}
      onSave={() =>
        onSave({
          name: name.trim() || 'Endpoint',
          description: description.trim(),
          endpoint: endpoint.trim() || '/',
          method,
          request: request.trim(),
          response: response.trim(),
          /* Free-text box removed — headers live in the request contract.
             Pass through any legacy value so a re-save doesn't wipe it. */
          headers: (initialHeaders || '').trim(),
          tags,
          group,
        })
      }
      saveDisabled={!name.trim()}
    >
      <ThemedSelect
        label={t('endpoint_method')}
        value={method}
        onChange={(v) => handleChange('method', v as EndpointMethod)}
        options={methodOptions}
        data-testid="input_endpoint_method"
      />
      <ThemedTextField
        margin="dense"
        label={grpc ? t('endpoint_rpc_path') : t('endpoint_path')}
        fullWidth
        value={endpoint}
        onChange={(e) => handleChange('endpoint', e.target.value)}
        placeholder={grpc ? '/package.Service/Method' : '/api/resource'}
        data-testid="input_endpoint_path"
      />
      {grpc ? (
        <>
          <ProtobufContractField
            side="request"
            label={t('endpoint_grpc_request')}
            value={request}
            onChange={(v) => handleChange('request', v)}
            testId="input_endpoint_request"
          />
          <ProtobufContractField
            side="response"
            label={t('endpoint_grpc_response')}
            value={response}
            onChange={(v) => handleChange('response', v)}
            testId="input_endpoint_response"
          />
        </>
      ) : (
        <>
          <HttpContractField
            side="request"
            label={websocket ? t('endpoint_client_messages') : t('endpoint_request')}
            value={request}
            onChange={(v) => handleChange('request', v)}
            path={endpoint}
            method={method}
            testId="input_endpoint_request"
          />
          <HttpContractField
            side="response"
            label={websocket ? t('endpoint_server_messages') : t('endpoint_response')}
            value={response}
            onChange={(v) => handleChange('response', v)}
            path={endpoint}
            method={method}
            testId="input_endpoint_response"
          />
        </>
      )}
    </BaseEditDialog>
  );
}
