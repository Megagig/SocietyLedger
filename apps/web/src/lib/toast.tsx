import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { accessCopy, classifyAccessError, moduleDisplayName } from '@societyledger/shared';

/**
 * Toast notification utilities using Mantine Notifications
 */

export const toast = {
  success: (message: string, title?: string) => {
    notifications.show({
      title: title || 'Success',
      message,
      color: 'green',
      icon: <IconCheck size={18} />,
      autoClose: 4000,
    });
  },

  error: (message: string, title?: string) => {
    notifications.show({
      title: title || 'Error',
      message,
      color: 'red',
      icon: <IconX size={18} />,
      autoClose: 6000,
    });
  },

  warning: (message: string, title?: string) => {
    notifications.show({
      title: title || 'Warning',
      message,
      color: 'yellow',
      icon: <IconAlertCircle size={18} />,
      autoClose: 5000,
    });
  },

  info: (message: string, title?: string) => {
    notifications.show({
      title: title || 'Info',
      message,
      color: 'blue',
      icon: <IconInfoCircle size={18} />,
      autoClose: 4000,
    });
  },

  /**
   * Handle API errors with user-friendly messages
   */
  apiError: (error: any, defaultMessage: string = 'An error occurred') => {
    let message = defaultMessage;
    let title = 'Error';

    if (error?.response?.data) {
      const data = error.response.data;
      
      // A refusal because of the person's role or their association's plan: say so plainly, the same way everywhere.
      const kind = classifyAccessError({ status: error.response.status, code: data.code, error: data.error, message: data.message });
      if (kind) {
        const copy = accessCopy(kind, { moduleName: moduleDisplayName(data.module), surface: 'web' });
        title = copy.title;
        message = copy.description;
      }
      // Any other 403 is a rule with its own message (for example "ask another officer"): show it as written.
      else if (error.response.status === 403) {
        title = 'Not allowed';
        message = data.message || "You don't have permission to do this. Ask your association administrator if you need access.";
      }
      // Handle authentication errors
      else if (error.response.status === 401) {
        title = 'Authentication Required';
        message = 'Please log in to continue';
      }
      // Handle validation errors
      else if (error.response.status === 400) {
        title = 'Invalid Request';
        message = data.message || 'Please check your input and try again';
        
        if (data.errors && Array.isArray(data.errors)) {
          message += '\n\n' + data.errors.map((e: any) => e.message).join('\n');
        }
      }
      // Handle not found errors
      else if (error.response.status === 404) {
        title = 'Not Found';
        message = data.message || 'The requested resource was not found';
      }
      // Handle server errors
      else if (error.response.status >= 500) {
        title = 'Server Error';
        message = 'Something went wrong on our end. Please try again later.';
      }
      // Generic error with message from server
      else if (data.message) {
        message = data.message;
      }
    }
    // Handle network errors
    else if (error?.message === 'Network Error') {
      title = 'Connection Error';
      message = 'Unable to connect to the server. Please check your internet connection.';
    }
    // Handle timeout errors
    else if (error?.code === 'ECONNABORTED') {
      title = 'Request Timeout';
      message = 'The request took too long. Please try again.';
    }

    notifications.show({
      title,
      message,
      color: 'red',
      icon: <IconX size={18} />,
      autoClose: 8000, // Longer duration for error messages
    });
  },

  /**
   * Show a loading notification that can be updated
   */
  loading: (message: string, id?: string) => {
    const notificationId = id || `loading-${Date.now()}`;
    notifications.show({
      id: notificationId,
      title: 'Loading',
      message,
      color: 'blue',
      loading: true,
      autoClose: false,
      withCloseButton: false,
    });
    return notificationId;
  },

  /**
   * Update a loading notification to success
   */
  updateSuccess: (id: string, message: string, title?: string) => {
    notifications.update({
      id,
      title: title || 'Success',
      message,
      color: 'green',
      icon: <IconCheck size={18} />,
      loading: false,
      autoClose: 4000,
    });
  },

  /**
   * Update a loading notification to error
   */
  updateError: (id: string, message: string, title?: string) => {
    notifications.update({
      id,
      title: title || 'Error',
      message,
      color: 'red',
      icon: <IconX size={18} />,
      loading: false,
      autoClose: 6000,
    });
  },
};
