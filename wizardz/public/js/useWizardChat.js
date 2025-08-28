/**
 * useWizardChat - React Hook for Wizardz Integration
 * Copyright (c) 2025, TierneyMorris Pty Ltd
 * 
 * Custom React hook for easy integration with Wizardz agentic document creation
 * Designed to work with frappe-react-sdk
 */

import { useFrappeCall, useFrappePostCall } from 'frappe-react-sdk';
import { useState, useCallback, useEffect } from 'react';

export const useWizardChat = (doctype, existingDoc = null) => {
    const [sessionId, setSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionStatus, setSessionStatus] = useState(null);
    const [draftData, setDraftData] = useState({});
    const [error, setError] = useState(null);

    // API calls using frappe-react-sdk
    const { call: createSession } = useFrappePostCall('wizardz.react_api.create_wizard_session');
    const { call: sendMessage } = useFrappePostCall('wizardz.react_api.chat');
    const { call: getSessionState } = useFrappePostCall('wizardz.react_api.get_session_state');
    const { call: finalizeDocument } = useFrappePostCall('wizardz.react_api.finalize_session');
    const { call: resumeSession } = useFrappePostCall('wizardz.react_api.resume_session');

    // Clear error when starting new actions
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Start a new wizard session
    const startSession = useCallback(async (sessionName) => {
        setIsLoading(true);
        clearError();
        
        try {
            const result = await createSession({
                doctype,
                session_name: sessionName,
                existing_doc: existingDoc
            });

            if (result.success) {
                setSessionId(result.session_id);
                setMessages([{
                    type: 'assistant',
                    content: result.initial_message,
                    timestamp: new Date()
                }]);
                setSessionStatus(result.mode);
                return result;
            } else {
                setError(result.error || 'Failed to start session');
                return result;
            }
        } catch (err) {
            const errorMsg = err.message || 'Failed to start session';
            setError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setIsLoading(false);
        }
    }, [doctype, existingDoc, createSession, clearError]);

    // Send a chat message
    const chat = useCallback(async (message) => {
        if (!sessionId || !message.trim()) return;

        setIsLoading(true);
        clearError();
        
        // Add user message immediately for better UX
        const userMessage = {
            type: 'user',
            content: message,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);

        try {
            const result = await sendMessage({
                session_id: sessionId,
                message: message
            });

            if (result.success) {
                const assistantMessage = {
                    type: 'assistant',
                    content: result.message,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
                setSessionStatus(result.status);
                setDraftData(result.draft_data || {});
                return result;
            } else {
                // Handle error - add error message to chat
                const errorMessage = {
                    type: 'error',
                    content: result.error || 'Something went wrong',
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, errorMessage]);
                setError(result.error);
                return result;
            }
        } catch (err) {
            const errorMsg = err.message || 'Failed to send message';
            const errorMessage = {
                type: 'error',
                content: errorMsg,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
            setError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, sendMessage, clearError]);

    // Load an existing session
    const loadSession = useCallback(async (existingSessionId) => {
        setIsLoading(true);
        clearError();
        
        try {
            const result = await resumeSession({
                session_id: existingSessionId
            });

            if (result.success) {
                setSessionId(existingSessionId);
                setMessages(result.conversation.map(msg => ({
                    type: msg.message_type === 'user' ? 'user' : 'assistant',
                    content: msg.message_content,
                    timestamp: new Date(msg.timestamp)
                })));
                setSessionStatus(result.status);
                setDraftData(result.draft_data || {});
                return result;
            } else {
                setError(result.error || 'Failed to load session');
                return result;
            }
        } catch (err) {
            const errorMsg = err.message || 'Failed to load session';
            setError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setIsLoading(false);
        }
    }, [resumeSession, clearError]);

    // Finalize the document
    const finalize = useCallback(async () => {
        if (!sessionId) return;

        setIsLoading(true);
        clearError();
        
        try {
            const result = await finalizeDocument({
                session_id: sessionId
            });
            
            if (result.success) {
                setSessionStatus('Completed');
                // Add success message to chat
                const successMessage = {
                    type: 'system',
                    content: `Document created successfully: ${result.document_name}`,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, successMessage]);
            } else {
                setError(result.error || 'Failed to create document');
            }
            
            return result;
        } catch (err) {
            const errorMsg = err.message || 'Failed to create document';
            setError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, finalizeDocument, clearError]);

    // Refresh session state
    const refreshState = useCallback(async () => {
        if (!sessionId) return;

        try {
            const result = await getSessionState({
                session_id: sessionId
            });

            if (result.success) {
                setSessionStatus(result.status);
                setDraftData(result.draft_data || {});
                return result;
            }
        } catch (err) {
            console.warn('Failed to refresh session state:', err);
        }
    }, [sessionId, getSessionState]);

    // Auto-refresh state periodically when session is active
    useEffect(() => {
        if (!sessionId) return;

        const interval = setInterval(refreshState, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [sessionId, refreshState]);

    return {
        // State
        sessionId,
        messages,
        isLoading,
        sessionStatus,
        draftData,
        error,
        
        // Actions
        startSession,
        chat,
        loadSession,
        finalize,
        refreshState,
        clearError,
        
        // Computed properties
        canFinalize: sessionStatus === 'In Progress' || sessionStatus === 'Update Mode',
        isActive: !!sessionId,
        isCompleted: sessionStatus === 'Completed',
        hasError: !!error,
        
        // Utilities
        reset: useCallback(() => {
            setSessionId(null);
            setMessages([]);
            setSessionStatus(null);
            setDraftData({});
            setError(null);
        }, [])
    };
};

// Additional hook for wizard discovery
export const useWizardInfo = (doctype) => {
    const { data, error, isLoading } = useFrappeCall(
        'wizardz.react_api.get_wizard_info',
        { doctype },
        `wizard-info-${doctype}`,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false
        }
    );

    return {
        wizardInfo: data,
        hasWizard: data?.success === true,
        isLoading,
        error: error || (data?.success === false ? data.error : null)
    };
};

// Hook for getting available doctypes with wizards
export const useAvailableWizards = () => {
    const { data, error, isLoading, mutate } = useFrappeCall(
        'wizardz.react_api.get_available_doctypes',
        undefined,
        'available-wizards',
        {
            revalidateOnFocus: false
        }
    );

    return {
        doctypes: data?.doctypes || [],
        isLoading,
        error: error || (data?.success === false ? data.error : null),
        refresh: mutate
    };
};

// Hook for managing user sessions
export const useUserSessions = () => {
    const { data, error, isLoading, mutate } = useFrappeCall(
        'wizardz.react_api.get_user_sessions',
        undefined,
        'user-sessions',
        {
            revalidateOnFocus: true
        }
    );

    return {
        sessions: data?.sessions || [],
        isLoading,
        error: error || (data?.success === false ? data.error : null),
        refresh: mutate
    };
};
