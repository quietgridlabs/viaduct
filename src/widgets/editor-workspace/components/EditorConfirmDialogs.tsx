import ConfirmDialog from '@components/common/ConfirmDialog';

type DeleteEdgeState = {
  sourceId: string;
  targetId: string;
  edgeId: string;
} | null;

type Props = {
  logoutConfirmOpen: boolean;
  logoutLoading: boolean;
  onLogoutCancel: () => void;
  onLogoutConfirm: () => void;
  pendingDeleteEdge: DeleteEdgeState;
  onDeleteEdgeCancel: () => void;
  onDeleteEdgeConfirm: () => void;
  pendingDeleteNodeId: string | null;
  pendingDeleteNodeName: string;
  onDeleteNodeCancel: () => void;
  onDeleteNodeConfirm: () => void;
};

export default function EditorConfirmDialogs({
  logoutConfirmOpen,
  logoutLoading,
  onLogoutCancel,
  onLogoutConfirm,
  pendingDeleteEdge,
  onDeleteEdgeCancel,
  onDeleteEdgeConfirm,
  pendingDeleteNodeId,
  pendingDeleteNodeName,
  onDeleteNodeCancel,
  onDeleteNodeConfirm,
}: Props) {
  return (
    <>
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Log out?"
        content="You are about to leave this session. Are you sure you want to log out?"
        onCancel={onLogoutCancel}
        onConfirm={onLogoutConfirm}
        confirmText="Yes, log out"
        cancelText="Cancel"
        confirmLoading={logoutLoading}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteEdge)}
        title="Delete connection?"
        content="Are you sure you want to delete this connection? This action cannot be undone."
        onCancel={onDeleteEdgeCancel}
        onConfirm={onDeleteEdgeConfirm}
        confirmText="Delete"
        cancelText="Cancel"
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteNodeId)}
        title="Delete element?"
        content={`Are you sure you want to delete "${pendingDeleteNodeName}"? This action cannot be undone.`}
        onCancel={onDeleteNodeCancel}
        onConfirm={onDeleteNodeConfirm}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}
