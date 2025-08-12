import React, { useState, useRef } from 'react';
import axios from 'axios';
import JSZip from 'jszip';
import './App.css';

function App() {
  const [selectedImages, setSelectedImages] = useState([]); // { id, file, dataUrl }
  const [processedImages, setProcessedImages] = useState([]); // { id, blobUrl, bgType, bgValue }
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef();

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleFiles = (files) => {
    setError(null);
    const newFiles = Array.from(files).map((file) => {
      const id = generateId();
      return { id, file, dataUrl: null };
    });

    newFiles.forEach(({ file, id }) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImages((prev) =>
          prev.map((img) => (img.id === id ? { ...img, dataUrl: e.target.result } : img))
        );
      };
      reader.readAsDataURL(file);
    });

    setSelectedImages((prev) => [...prev, ...newFiles]);
  };

  const onInputChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = null;
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const onDragOver = (e) => e.preventDefault();

  const removeBackgroundAll = async () => {
    if (selectedImages.length === 0) {
      setError('Please upload at least one image.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    const processed = [];

    for (const img of selectedImages) {
      try {
        const response = await fetch(img.dataUrl);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append('image_file', blob);

        const result = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
          headers: {
            'X-Api-Key': 'oVQ9gbUQoAcFBxLc64bF6E8w', // Replace with your API key
          },
          responseType: 'blob',
        });

        const processedUrl = URL.createObjectURL(result.data);
        processed.push({
          id: img.id,
          blobUrl: processedUrl,
          bgType: 'transparent',
          bgValue: null,
        });
      } catch (err) {
        setError('Error processing one or more images.');
        console.error(err);
      }
    }

    setProcessedImages(processed);
    setIsProcessing(false);
  };

  const updateBackground = (id, type, value) => {
    setProcessedImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, bgType: type, bgValue: value } : img))
    );
  };

  const getBackgroundStyle = (bgType, bgValue) => {
    if (bgType === 'color') return bgValue || '#fff';
    if (bgType === 'gradient') return bgValue || 'linear-gradient(45deg, #667eea, #764ba2)';
    if (bgType === 'image') return `url(${bgValue}) center/cover no-repeat`;
    return 'transparent';
  };

  const downloadWithBackground = async (id) => {
    const imgData = processedImages.find((img) => img.id === id);
    if (!imgData) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const processedImg = await new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.src = imgData.blobUrl;
    });

    canvas.width = processedImg.width;
    canvas.height = processedImg.height;

    if (imgData.bgType === 'color') {
      ctx.fillStyle = imgData.bgValue || '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (imgData.bgType === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#667eea');
      grad.addColorStop(1, '#764ba2');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (imgData.bgType === 'image' && imgData.bgValue) {
      const bgImg = await new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.src = imgData.bgValue;
      });
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(processedImg, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'background-replaced.png';
    link.href = dataUrl;
    link.click();
  };

  // NEW FUNCTION to download all processed images as a ZIP
  const downloadAllAsZip = async () => {
    if (processedImages.length === 0) return;

    const zip = new JSZip();

    for (const imgData of processedImages) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const processedImg = await new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.src = imgData.blobUrl;
      });

      canvas.width = processedImg.width;
      canvas.height = processedImg.height;

      if (imgData.bgType === 'color') {
        ctx.fillStyle = imgData.bgValue || '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (imgData.bgType === 'gradient') {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#667eea');
        grad.addColorStop(1, '#764ba2');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (imgData.bgType === 'image' && imgData.bgValue) {
        const bgImg = await new Promise((resolve) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.src = imgData.bgValue;
        });
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(processedImg, 0, 0);

      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1]; // Get base64 part

      zip.file(`${imgData.id}.png`, base64Data, { base64: true });
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'processed-images.zip';
    link.click();
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">✨ AI Background Remover</h1>
        <p className="subtitle">
          Upload multiple images, remove backgrounds, and replace with your own!
        </p>
      </header>

      <section
        className="upload-section"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={() => fileInputRef.current.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onInputChange}
          className="file-input"
        />
        <p className="upload-text">Drag & drop images here, or click to select files</p>
        <p className="upload-note">You can upload multiple images at once</p>
      </section>

      {error && <div className="error-message">⚠️ {error}</div>}

      <div className="action-button-container">
        <button
          onClick={removeBackgroundAll}
          disabled={isProcessing || selectedImages.length === 0}
          className={`action-button ${isProcessing ? 'processing' : ''}`}
        >
          {isProcessing ? '🤖 Processing images...' : '✨ Remove Backgrounds'}
        </button>
      </div>

      {/* Show Download ZIP button only if there are processed images */}
      {processedImages.length > 0 && (
        <div className="action-button-container">
          <button
            onClick={downloadAllAsZip}
            className="action-button"
            disabled={isProcessing}
          >
            📦 Download All as ZIP
          </button>
        </div>
      )}

      <main className="images-grid">
        {selectedImages.map(({ id, dataUrl }) => {
          const processed = processedImages.find((img) => img.id === id);
          return (
            <article key={id} className="image-card">
              <h3 className="section-title">Original Image</h3>
              <img
                src={dataUrl}
                alt="Original"
                className="image-preview zoom-on-hover"
              />

              <h3 className="section-title">Processed Image</h3>
              <div
                className="processed-image-wrapper"
                style={{ background: processed ? getBackgroundStyle(processed.bgType, processed.bgValue) : 'transparent' }}
              >
                {processed ? (
                  <img
                    src={processed.blobUrl}
                    alt="Processed"
                    className="processed-image zoom-on-hover"
                  />
                ) : (
                  <p className="placeholder-text">
                    {isProcessing ? 'Processing...' : 'No processed image yet'}
                  </p>
                )}
              </div>

              {processed && (
                <div className="background-controls">
                  <label>Replace Background:</label>
                  <select
                    value={processed.bgType}
                    onChange={(e) => updateBackground(id, e.target.value, null)}
                    className="background-select"
                  >
                    <option value="transparent">Transparent (default)</option>
                    <option value="color">Solid Color</option>
                    <option value="gradient">Gradient</option>
                    <option value="image">Custom Image</option>
                  </select>

                  {processed.bgType === 'color' && (
                    <input
                      type="color"
                      value={processed.bgValue || '#ffffff'}
                      onChange={(e) => updateBackground(id, 'color', e.target.value)}
                      className="color-picker"
                    />
                  )}

                  {processed.bgType === 'gradient' && (
                    <div className="gradient-inputs">
                      <input
                        type="color"
                        defaultValue="#667eea"
                        onChange={(e) => {
                          const otherColor = processed.bgValue?.split(',')[1] || '#764ba2';
                          updateBackground(id, 'gradient', `linear-gradient(45deg, ${e.target.value}, ${otherColor})`);
                        }}
                        className="color-picker-half"
                      />
                      <input
                        type="color"
                        defaultValue="#764ba2"
                        onChange={(e) => {
                          const otherColor = processed.bgValue?.split(',')[0] || '#667eea';
                          updateBackground(id, 'gradient', `linear-gradient(45deg, ${otherColor}, ${e.target.value})`);
                        }}
                        className="color-picker-half"
                      />
                    </div>
                  )}

                  {processed.bgType === 'image' && (
                    <input
                      type="text"
                      placeholder="Enter image URL"
                      value={processed.bgValue || ''}
                      onChange={(e) => updateBackground(id, 'image', e.target.value)}
                      className="image-url-input"
                    />
                  )}
                </div>
              )}

              {processed && (
                <button
                  onClick={() => downloadWithBackground(id)}
                  className="download-button"
                >
                  💾 Download with Background
                </button>
              )}
            </article>
          );
        })}
      </main>
    </div>
  );
}

export default App;
