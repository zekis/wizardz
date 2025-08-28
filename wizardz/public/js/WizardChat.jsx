/**
 * WizardChat - Reusable React Component for Wizardz Integration
 * Copyright (c) 2025, TierneyMorris Pty Ltd
 * 
 * Drop-in React component for agentic document creation
 * Designed to work with frappe-react-sdk and useWizardChat hook
 */

import React, { useState, useRef, useEffect } from 'react';
import { useWizardChat, useWizardInfo } from './useWizardChat';

const WizardChat = ({ 
    doctype, 
    existingDoc = null, 
    onDocumentCreated,
    onSessionStarted,
    onError,
    className = "",
    autoStart = false,
    showHeader = true,
    placeholder = "Type your message...",
    disabled = false
}) => {
    const [currentMessage, setCurrentMessage] = useState('');
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Get wizard info for this doctype
    const { hasWizard, wizardInfo, isLoading: wizardLoading } = useWizardInfo(doctype);

    // Main chat hook
    const {
        messages,
        isLoading,
        sessionStatus,
        draftData,
        error,
        startSession,
        chat,
        finalize,
        canFinalize,
        isActive,
        isCompleted,
        hasError,
        clearError,
        reset
    } = useWizardChat(doctype, existingDoc);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-start session if requested
    useEffect(() => {
        if (autoStart && hasWizard && !isActive && !wizardLoading) {
            handleStart();
        }
    }, [autoStart, hasWizard, isActive, wizardLoading]);

    // Handle errors
    useEffect(() => {
        if (hasError && onError) {
            onError(error);
        }
    }, [hasError, error, onError]);

    // Handle session started
    useEffect(() => {
        if (isActive && onSessionStarted) {
            onSessionStarted({ sessionId: sessionStatus, doctype });
        }
    }, [isActive, sessionStatus, doctype, onSessionStarted]);

    const handleStart = async () => {
        const sessionName = existingDoc 
            ? `Update ${doctype} - ${existingDoc.name || existingDoc}`
            : `New ${doctype}`;
        
        await startSession(sessionName);
    };

    const handleSendMessage = async () => {
        if (!currentMessage.trim() || isLoading) return;
        
        await chat(currentMessage);
        setCurrentMessage('');
        
        // Focus back to textarea
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 100);
    };

    const handleFinalize = async () => {
        const result = await finalize();
        if (result.success && onDocumentCreated) {
            onDocumentCreated(result);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleReset = () => {
        reset();
        setCurrentMessage('');
    };

    // Loading state
    if (wizardLoading) {
        return (
            <div className={`wizard-chat-loading ${className}`}>
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Checking wizard availability...</p>
                </div>
            </div>
        );
    }

    // No wizard available
    if (!hasWizard) {
        return (
            <div className={`wizard-chat-unavailable ${className}`}>
                <div className="unavailable-message">
                    <h4>AI Assistant Not Available</h4>
                    <p>No wizard is configured for {doctype}.</p>
                    {wizardInfo?.available_doctypes?.length > 0 && (
                        <div className="available-doctypes">
                            <p>Available for:</p>
                            <ul>
                                {wizardInfo.available_doctypes.map(dt => (
                                    <li key={dt}>{dt}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Session not started
    if (!isActive) {
        return (
            <div className={`wizard-chat-start ${className}`}>
                {showHeader && (
                    <div className="chat-header">
                        <h3>
                            {existingDoc ? `Update ${doctype}` : `Create ${doctype}`}
                        </h3>
                        <p className="wizard-info">
                            Powered by {wizardInfo?.wizard_name} ({wizardInfo?.ai_model})
                        </p>
                    </div>
                )}
                
                <div className="start-content">
                    <p>
                        Start a conversation with the AI assistant to {existingDoc ? 'update' : 'create'} your {doctype}.
                    </p>
                    
                    {hasError && (
                        <div className="error-message">
                            <p>{error}</p>
                            <button onClick={clearError} className="btn btn-sm">
                                Dismiss
                            </button>
                        </div>
                    )}
                    
                    <div className="start-actions">
                        <button 
                            onClick={handleStart}
                            disabled={isLoading || disabled}
                            className="btn btn-primary"
                        >
                            {isLoading ? 'Starting...' : 'Start AI Assistant'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Active chat session
    return (
        <div className={`wizard-chat ${className} ${isCompleted ? 'completed' : ''}`}>
            {showHeader && (
                <div className="chat-header">
                    <div className="header-content">
                        <h4>{existingDoc ? `Updating ${doctype}` : `Creating ${doctype}`}</h4>
                        <div className="header-actions">
                            <span className={`status-badge status-${sessionStatus?.toLowerCase().replace(' ', '-')}`}>
                                {sessionStatus}
                            </span>
                            <button 
                                onClick={handleReset}
                                className="btn btn-sm btn-secondary"
                                title="Start over"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="chat-messages">
                {messages.map((message, index) => (
                    <div 
                        key={index} 
                        className={`message message-${message.type}`}
                    >
                        <div className="message-content">
                            {message.content}
                        </div>
                        <div className="message-time">
                            {message.timestamp.toLocaleTimeString()}
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="message message-assistant loading">
                        <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <div className="loading-text">AI is thinking...</div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            {hasError && (
                <div className="chat-error">
                    <p>{error}</p>
                    <button onClick={clearError} className="btn btn-sm">
                        Dismiss
                    </button>
                </div>
            )}

            <div className="chat-input">
                <div className="input-group">
                    <textarea
                        ref={textareaRef}
                        value={currentMessage}
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={placeholder}
                        disabled={isLoading || disabled || isCompleted}
                        rows={2}
                        className="form-control"
                    />
                    <div className="input-group-append">
                        <button
                            onClick={handleSendMessage}
                            disabled={isLoading || !currentMessage.trim() || disabled || isCompleted}
                            className="btn btn-primary"
                        >
                            Send
                        </button>
                    </div>
                </div>
                
                {canFinalize && !isCompleted && (
                    <div className="finalize-section">
                        <button
                            onClick={handleFinalize}
                            disabled={isLoading || disabled}
                            className="btn btn-success"
                        >
                            {existingDoc ? 'Update Document' : 'Create Document'}
                        </button>
                    </div>
                )}
                
                {isCompleted && (
                    <div className="completed-section">
                        <p className="success-message">
                            Document {existingDoc ? 'updated' : 'created'} successfully!
                        </p>
                        <button
                            onClick={handleReset}
                            className="btn btn-secondary"
                        >
                            Start New Session
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// Additional utility components

// Session selector component
export const WizardSessionSelector = ({ onSessionSelected, className = "" }) => {
    const { sessions, isLoading, error } = useUserSessions();
    const [selectedSession, setSelectedSession] = useState('');

    const handleSelect = () => {
        if (selectedSession && onSessionSelected) {
            const session = sessions.find(s => s.session_id === selectedSession);
            onSessionSelected(session);
        }
    };

    if (isLoading) {
        return <div className="loading">Loading sessions...</div>;
    }

    if (error) {
        return <div className="error">Error loading sessions: {error}</div>;
    }

    const resumableSessions = sessions.filter(s => s.can_resume);

    if (resumableSessions.length === 0) {
        return (
            <div className={`no-sessions ${className}`}>
                <p>No resumable sessions found.</p>
            </div>
        );
    }

    return (
        <div className={`wizard-session-selector ${className}`}>
            <h4>Resume Previous Session</h4>
            <div className="session-list">
                <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="form-control"
                >
                    <option value="">Select a session...</option>
                    {resumableSessions.map(session => (
                        <option key={session.session_id} value={session.session_id}>
                            {session.name} ({session.doctype}) - {session.status}
                        </option>
                    ))}
                </select>
                <button
                    onClick={handleSelect}
                    disabled={!selectedSession}
                    className="btn btn-primary"
                >
                    Resume Session
                </button>
            </div>
        </div>
    );
};

// Quick wizard launcher for multiple doctypes
export const WizardLauncher = ({ onWizardSelected, className = "" }) => {
    const { doctypes, isLoading, error } = useAvailableWizards();

    if (isLoading) {
        return <div className="loading">Loading available wizards...</div>;
    }

    if (error) {
        return <div className="error">Error loading wizards: {error}</div>;
    }

    return (
        <div className={`wizard-launcher ${className}`}>
            <h4>Create New Document</h4>
            <div className="wizard-grid">
                {doctypes.map(wizard => (
                    <div
                        key={wizard.doctype}
                        className="wizard-card"
                        onClick={() => onWizardSelected && onWizardSelected(wizard)}
                    >
                        <h5>{wizard.doctype}</h5>
                        <p>{wizard.wizard_name}</p>
                        <small>Powered by {wizard.ai_model}</small>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WizardChat;
