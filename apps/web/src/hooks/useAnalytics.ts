'use client';

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

type EventParams = {
  event_category?: string;
  event_label?: string;
  value?: number;
  [key: string]: any;
};

/**
 * Custom hook for Google Analytics event tracking
 */
export function useAnalytics() {
  const trackEvent = (eventName: string, params?: EventParams) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, params);
    }
  };

  // Pre-defined event trackers
  const trackSignUpClick = (location?: string) => {
    trackEvent('sign_up_click', {
      event_category: 'engagement',
      event_label: location || 'Sign Up Button',
    });
  };

  const trackLoginClick = (location?: string) => {
    trackEvent('login_click', {
      event_category: 'engagement',
      event_label: location || 'Login Button',
    });
  };

  const trackContactFormSubmit = () => {
    trackEvent('contact_form_submit', {
      event_category: 'engagement',
      event_label: 'Contact Form',
    });
  };

  const trackPricingView = (plan?: string) => {
    trackEvent('pricing_view', {
      event_category: 'engagement',
      event_label: plan || 'Pricing Page',
    });
  };

  const trackFeatureClick = (featureName: string) => {
    trackEvent('feature_click', {
      event_category: 'engagement',
      event_label: featureName,
    });
  };

  const trackDocumentationView = (docTitle: string) => {
    trackEvent('documentation_view', {
      event_category: 'engagement',
      event_label: docTitle,
    });
  };

  const trackBlogPostView = (postTitle: string) => {
    trackEvent('blog_post_view', {
      event_category: 'content',
      event_label: postTitle,
    });
  };

  const trackTrialStart = () => {
    trackEvent('trial_start', {
      event_category: 'conversion',
      event_label: 'Free Trial Started',
    });
  };

  const trackNewsletterSignup = () => {
    trackEvent('newsletter_signup', {
      event_category: 'engagement',
      event_label: 'Newsletter Subscription',
    });
  };

  const trackSocialClick = (platform: string) => {
    trackEvent('social_click', {
      event_category: 'engagement',
      event_label: platform,
    });
  };

  return {
    trackEvent,
    trackSignUpClick,
    trackLoginClick,
    trackContactFormSubmit,
    trackPricingView,
    trackFeatureClick,
    trackDocumentationView,
    trackBlogPostView,
    trackTrialStart,
    trackNewsletterSignup,
    trackSocialClick,
  };
}
