import React, { useState, useRef, useCallback } from 'react';

const GENDER_OPTIONS = [
    { value: 'girl', label: 'Girl', icon: '♀' },
    { value: 'boy', label: 'Boy', icon: '♂' },
    { value: 'surprise', label: 'Surprise', icon: '✦' },
];

function PhotoUpload({ label, sublabel, preview, onFile, onClear }) {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) onFile(file);
    }, [onFile]);

    const handleChange = (e) => {
        const file = e.target.files[0];
        if (file) onFile(file);
    };

    return (
        <div
            className={`bp-upload-zone ${dragging ? 'bp-dragging' : ''} ${preview ? 'bp-has-photo' : ''}`}
            onClick={() => !preview && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
        >
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleChange}
            />
            {preview ? (
                <>
                    <img src={preview} alt={label} className="bp-photo-preview" />
                    <div className="bp-photo-overlay">
                        <button
                            className="bp-change-btn"
                            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                        >
                            Change
                        </button>
                        <button
                            className="bp-clear-btn"
                            onClick={(e) => { e.stopPropagation(); onClear(); }}
                        >
                            ✕
                        </button>
                    </div>
                    <div className="bp-upload-label">{label}</div>
                </>
            ) : (
                <div className="bp-upload-placeholder">
                    <div className="bp-upload-icon">
                        {label === 'Mother' ? '♀' : '♂'}
                    </div>
                    <div className="bp-upload-text">{label}</div>
                    <div className="bp-upload-sub">{sublabel}</div>
                </div>
            )}
        </div>
    );
}

function InheritanceBar({ feature, from, percent, description }) {
    const fromColor = from === 'Mother' ? 'var(--bp-mom)' : from === 'Father' ? 'var(--bp-dad)' : 'var(--bp-both)';
    return (
        <div className="bp-inheritance-row">
            <div className="bp-inheritance-header">
                <span className="bp-feature-name">{feature}</span>
                <span className="bp-feature-from" style={{ color: fromColor }}>
                    {from} {from !== 'Both' && `${percent}%`}
                </span>
            </div>
            <div className="bp-bar-track">
                <div
                    className="bp-bar-fill"
                    style={{
                        width: `${percent}%`,
                        background: fromColor,
                        marginLeft: from === 'Father' ? `${100 - percent}%` : 0
                    }}
                />
            </div>
            <div className="bp-inheritance-desc">{description}</div>
        </div>
    );
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            // Strip the data:image/...;base64, prefix
            const base64 = result.split(',')[1];
            resolve({ base64, mimeType: file.type });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function BabyPredictor({ onBack }) {
    const [momFile, setMomFile] = useState(null);
    const [dadFile, setDadFile] = useState(null);
    const [momPreview, setMomPreview] = useState(null);
    const [dadPreview, setDadPreview] = useState(null);
    const [gender, setGender] = useState('surprise');
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleMomFile = (file) => {
        setMomFile(file);
        setMomPreview(URL.createObjectURL(file));
        setResult(null);
        setError(null);
    };

    const handleDadFile = (file) => {
        setDadFile(file);
        setDadPreview(URL.createObjectURL(file));
        setResult(null);
        setError(null);
    };

    const handlePredict = async () => {
        if (!momFile || !dadFile) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            setLoadingStep('Analyzing parent features...');
            const [mom, dad] = await Promise.all([
                fileToBase64(momFile),
                fileToBase64(dadFile)
            ]);

            setLoadingStep('Predicting genetic inheritance...');
            const response = await fetch('/api/baby/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    momImage: mom.base64,
                    dadImage: dad.base64,
                    momMimeType: mom.mimeType,
                    dadMimeType: dad.mimeType,
                    gender
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Prediction failed.');

            setLoadingStep('Generating baby portrait...');
            setResult(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
            setLoadingStep('');
        }
    };

    const handleDownload = () => {
        if (!result?.babyImageUrl) return;
        const a = document.createElement('a');
        a.href = result.babyImageUrl;
        a.download = 'baby-prediction.png';
        a.click();
    };

    const handleReset = () => {
        setResult(null);
        setError(null);
    };

    const canPredict = momFile && dadFile && !loading;

    return (
        <div className="bp-container">
            <div className="bp-header">
                <button className="back-btn" onClick={onBack}>←</button>
                <div className="bp-header-text">
                    <h1 className="bp-title">Baby Predictor</h1>
                    <p className="bp-subtitle">AI-powered child face prediction</p>
                </div>
            </div>

            {!result ? (
                <>
                    <div className="bp-uploads">
                        <PhotoUpload
                            label="Mother"
                            sublabel="Upload a clear front-facing photo"
                            preview={momPreview}
                            onFile={handleMomFile}
                            onClear={() => { setMomFile(null); setMomPreview(null); }}
                        />
                        <div className="bp-plus">+</div>
                        <PhotoUpload
                            label="Father"
                            sublabel="Upload a clear front-facing photo"
                            preview={dadPreview}
                            onFile={handleDadFile}
                            onClear={() => { setDadFile(null); setDadPreview(null); }}
                        />
                    </div>

                    <div className="bp-gender-section">
                        <div className="bp-section-label">Predict as</div>
                        <div className="bp-gender-pills">
                            {GENDER_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    className={`bp-gender-pill ${gender === opt.value ? 'bp-gender-active' : ''}`}
                                    onClick={() => setGender(opt.value)}
                                >
                                    <span className="bp-gender-icon">{opt.icon}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="bp-error">
                            <span className="bp-error-icon">!</span>
                            {error}
                        </div>
                    )}

                    <button
                        className="bp-predict-btn"
                        onClick={handlePredict}
                        disabled={!canPredict}
                    >
                        {loading ? (
                            <span className="bp-loading-state">
                                <span className="bp-spinner" />
                                {loadingStep}
                            </span>
                        ) : (
                            'Predict Baby'
                        )}
                    </button>

                    {!momFile && !dadFile && (
                        <p className="bp-hint">
                            Upload photos of both parents to generate a prediction.
                            For best results, use clear front-facing photos.
                        </p>
                    )}
                </>
            ) : (
                <div className="bp-results">
                    <div className="bp-result-image-wrap">
                        <img
                            src={result.babyImageUrl}
                            alt="Predicted baby"
                            className="bp-result-image"
                        />
                        <div className="bp-result-badge">
                            {gender === 'girl' ? '♀ Girl' : gender === 'boy' ? '♂ Boy' : '✦ Baby'}
                        </div>
                    </div>

                    <div className="bp-result-actions">
                        <button className="bp-download-btn" onClick={handleDownload}>
                            Download
                        </button>
                        <button className="bp-retry-btn" onClick={handleReset}>
                            Try Again
                        </button>
                    </div>

                    {result.analysis?.inheritance?.length > 0 && (
                        <div className="bp-inheritance-section">
                            <div className="bp-section-label">Genetic Inheritance</div>
                            <div className="bp-parent-legend">
                                <span className="bp-legend-dot" style={{ background: 'var(--bp-mom)' }} />
                                Mother
                                <span className="bp-legend-dot" style={{ background: 'var(--bp-dad)', marginLeft: 12 }} />
                                Father
                            </div>
                            {result.analysis.inheritance.map((item, i) => (
                                <InheritanceBar key={i} {...item} />
                            ))}
                        </div>
                    )}

                    {result.analysis?.motherFeatures && (
                        <div className="bp-parent-features">
                            <div className="bp-pf-col">
                                <div className="bp-pf-header" style={{ color: 'var(--bp-mom)' }}>Mother</div>
                                {Object.entries(result.analysis.motherFeatures).map(([k, v]) => (
                                    <div key={k} className="bp-pf-row">
                                        <span className="bp-pf-key">{k}</span>
                                        <span className="bp-pf-val">{v}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="bp-pf-col">
                                <div className="bp-pf-header" style={{ color: 'var(--bp-dad)' }}>Father</div>
                                {Object.entries(result.analysis.fatherFeatures).map(([k, v]) => (
                                    <div key={k} className="bp-pf-row">
                                        <span className="bp-pf-key">{k}</span>
                                        <span className="bp-pf-val">{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="bp-disclaimer">
                        This prediction is generated by AI for entertainment purposes only.
                        Actual genetics are far more complex.
                    </p>
                </div>
            )}
        </div>
    );
}
