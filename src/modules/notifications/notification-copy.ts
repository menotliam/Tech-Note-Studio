import type { NotificationIntent } from "./notification.types";

export const notificationCopy = {
  preferencesSaved(): NotificationIntent {
    return {
      variant: "success",
      title: "Preferences saved",
      description: "Your workspace preferences are up to date."
    };
  },
  preferencesFailed(): NotificationIntent {
    return {
      variant: "error",
      title: "Could not save preferences",
      description: "Your previous settings were restored."
    };
  },
  workspaceSaved(): NotificationIntent {
    return {
      variant: "success",
      title: "Workspace saved",
      description: "Workspace personalization has been updated."
    };
  },
  workspaceFailed(): NotificationIntent {
    return {
      variant: "error",
      title: "Could not save workspace",
      description: "Your previous workspace settings were restored."
    };
  },
  noteSaved(): NotificationIntent {
    return {
      variant: "success",
      title: "Note saved",
      description: "Latest changes are synced to your workspace."
    };
  },
  noteSaveFailed(): NotificationIntent {
    return {
      variant: "sync",
      title: "Could not save note",
      description: "Your local draft is preserved. Try again when the connection is stable."
    };
  },
  imageUploadStarted(count: number): NotificationIntent {
    return {
      variant: "upload",
      title: count === 1 ? "Uploading image" : `Uploading ${count} images`,
      description: "Images will appear in the editor after upload."
    };
  },
  imageUploadFinished(successCount: number, failedCount: number): NotificationIntent {
    if (failedCount === 0) {
      return {
        variant: "success",
        title: successCount === 1 ? "Image inserted" : `${successCount} images inserted`
      };
    }

    return {
      variant: "warning",
      title: successCount > 0 ? "Some images were not uploaded" : "Image upload failed",
      description: "Only PNG, JPEG, and WebP images up to 10 MB are supported."
    };
  },
  imageUploadOffline(): NotificationIntent {
    return {
      variant: "upload",
      title: "Image upload needs a connection",
      description: "Offline clipboard and drag/drop image upload is not supported yet."
    };
  },
  exportStarted(format: "pdf" | "docx"): NotificationIntent {
    return {
      variant: "export",
      title: `Preparing ${format.toUpperCase()} export`,
      description: "The download will begin when the file is ready."
    };
  },
  exportFinished(format: "pdf" | "docx"): NotificationIntent {
    return {
      variant: "success",
      title: `${format.toUpperCase()} export ready`,
      description: "The download has started."
    };
  },
  exportFailed(): NotificationIntent {
    return {
      variant: "error",
      title: "Export failed",
      description: "Could not prepare the export. Check selected notes and try again."
    };
  },
  lifecycleArchived(label: string): NotificationIntent {
    return {
      variant: "success",
      title: "Archived",
      description: `${label} moved to Archive.`
    };
  },
  lifecycleMovedToTrash(label: string): NotificationIntent {
    return {
      variant: "warning",
      title: "Moved to Trash",
      description: `${label} can be restored from Trash.`
    };
  },
  lifecycleRestored(label: string): NotificationIntent {
    return {
      variant: "success",
      title: "Restored",
      description: `${label} returned to the active workspace.`
    };
  },
  lifecycleDeletedForever(label: string): NotificationIntent {
    return {
      variant: "error",
      title: "Deleted forever",
      description: `${label} was permanently deleted.`
    };
  },
  lifecycleTrashEmptied(): NotificationIntent {
    return {
      variant: "error",
      title: "Trash emptied",
      description: "All Trash items were permanently deleted."
    };
  },
  syncFailed(): NotificationIntent {
    return {
      variant: "sync",
      title: "Sync paused",
      description: "Changes remain queued locally and will retry when the connection returns."
    };
  }
} as const;
