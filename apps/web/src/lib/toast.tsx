import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';

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
      
      // Handle permission denied errors
      if (error.response.status === 403) {
        title = 'Access Denied';
        message = data.message || 'You do not have permission to access this resource';
        
        if (data.requiredPermission) {
          message += `\n\nRequired permission: ${data.requiredPermission}`;
        }
        
        if (data.userRole) {
          message += `\nYour role: ${data.userRole}`;
        }
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
