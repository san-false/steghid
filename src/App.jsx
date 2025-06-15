import { useState } from 'react'
import './App.css'
import { Link } from 'react-router-dom'

function App() {
  const [mode, setMode] = useState('encode')
  const [coverImage, setCoverImage] = useState(null)
  const [secretImage, setSecretImage] = useState(null)
  const [password, setPassword] = useState('')
  const [resultImage, setResultImage] = useState(null)
  const [decodedImage, setDecodedImage] = useState(null)

  const handleCoverImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => setCoverImage(e.target.result)
      reader.readAsDataURL(file)
    }
  }

  const handleSecretImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => setSecretImage(e.target.result)
      reader.readAsDataURL(file)
    }
  }

  // Simple XOR encryption
  const encryptData = (data, pass) => {
    let result = ''
    for(let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data.charCodeAt(i) ^ pass.charCodeAt(i % pass.length))
    }
    return btoa(result)
  }

  // Simple XOR decryption
  const decryptData = (encoded, pass) => {
    try {
      const data = atob(encoded)
      let result = ''
      for(let i = 0; i < data.length; i++) {
        result += String.fromCharCode(data.charCodeAt(i) ^ pass.charCodeAt(i % pass.length))
      }
      return result
    } catch (e) {
      return null
    }
  }

  const handleEncode = async () => {
    if (!coverImage || !secretImage || !password) {
      alert('Please provide both images and a password')
      return
    }

    try {
      const coverCanvas = document.createElement('canvas')
      const secretCanvas = document.createElement('canvas')
      const coverCtx = coverCanvas.getContext('2d')
      const secretCtx = secretCanvas.getContext('2d')
      
      const coverImg = new Image()
      const secretImg = new Image()
      
      coverImg.onload = () => {
        coverCanvas.width = coverImg.width
        coverCanvas.height = coverImg.height
        coverCtx.drawImage(coverImg, 0, 0)
        
        secretImg.onload = () => {
          try {
            // Calculate maximum size for secret image
            const coverPixels = coverImg.width * coverImg.height
            const maxSecretPixels = Math.floor((coverPixels * 2 - 32) / 32) // Account for header and encryption overhead
            
            // Calculate scaling ratio
            let ratio = 1
            if (secretImg.width * secretImg.height > maxSecretPixels) {
              ratio = Math.sqrt(maxSecretPixels / (secretImg.width * secretImg.height))
            }
            
            // Scale secret image
            const newWidth = Math.floor(secretImg.width * ratio)
            const newHeight = Math.floor(secretImg.height * ratio)
            
            // Ensure minimum dimensions
            if (newWidth < 1 || newHeight < 1) {
              throw new Error('Cover image is too small to hide any secret image')
            }
            
            console.log('Scaling secret image to:', newWidth, 'x', newHeight)
            
            secretCanvas.width = newWidth
            secretCanvas.height = newHeight
            secretCtx.drawImage(secretImg, 0, 0, newWidth, newHeight)
            
            // Get image data
            const coverData = coverCtx.getImageData(0, 0, coverCanvas.width, coverCanvas.height)
            const secretData = secretCtx.getImageData(0, 0, newWidth, newHeight)
            
            // Prepare the data to hide
            const header = `${newWidth},${newHeight}|`
            const pixelData = Array.from(secretData.data).join(',')
            const fullData = header + pixelData
            
            // Encrypt the data
            const encryptedData = encryptData(fullData, password)
            
            // Convert to binary
            const dataBits = encryptedData.split('').map(char => 
              char.charCodeAt(0).toString(2).padStart(8, '0')
            ).join('')
            
            // Add length prefix (32 bits)
            const lengthBits = dataBits.length.toString(2).padStart(32, '0')
            const allBits = lengthBits + dataBits
            
            // Final size check
            if (allBits.length > coverData.data.length * 2 - 32) {
              throw new Error('Data still too large after scaling. Please use a larger cover image.')
            }
            
            // Embed the data
            const data = coverData.data
            for (let i = 0; i < allBits.length; i++) {
              const pixelIndex = Math.floor(i / 2) * 4
              const colorOffset = i % 2
              data[pixelIndex + colorOffset] = (data[pixelIndex + colorOffset] & 254) | parseInt(allBits[i])
            }
            
            // Set marker
            data[data.length - 4] = (data[data.length - 4] & 254) | 1
            
            coverCtx.putImageData(coverData, 0, 0)
            const resultUrl = coverCanvas.toDataURL('image/png')
            setResultImage(resultUrl)
            
            console.log('Encoding completed successfully')
          } catch (error) {
            console.error('Processing error:', error)
            alert(error.message)
            setResultImage(null)
          }
        }
        
        secretImg.src = secretImage
      }
      
      coverImg.src = coverImage
      
    } catch (error) {
      console.error('Encoding error:', error)
      alert(`Error hiding the image: ${error.message}`)
      setResultImage(null)
    }
  }

  const handleDecode = async () => {
    if (!coverImage || !password) {
      alert('Please provide an image and password')
      return
    }

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        try {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          
          // Extract length (first 32 bits)
          let lengthBits = ''
          for (let i = 0; i < 32; i++) {
            const pixelIndex = Math.floor(i / 2) * 4
            const colorOffset = i % 2
            lengthBits += data[pixelIndex + colorOffset] & 1
          }
          
          const messageLength = parseInt(lengthBits, 2)
          console.log('Detected message length:', messageLength)
          
          if (messageLength <= 0) {
            throw new Error('No hidden data found in this image')
          }

          // Extract data bits
          let dataBits = ''
          for (let i = 0; i < messageLength; i++) {
            const pixelIndex = Math.floor((i + 32) / 2) * 4
            const colorOffset = (i + 32) % 2
            dataBits += data[pixelIndex + colorOffset] & 1
          }
          
          // Convert to encrypted data
          let encryptedData = ''
          for (let i = 0; i < dataBits.length; i += 8) {
            const byte = dataBits.substr(i, 8)
            if (byte.length === 8) {
              encryptedData += String.fromCharCode(parseInt(byte, 2))
            }
          }
          
          // Decrypt and process
          const decrypted = decryptData(encryptedData, password)
          if (!decrypted) {
            throw new Error('Failed to decrypt data. Please check the password.')
          }

          console.log('Successfully decrypted data')

          // Split the decrypted data
          const separatorIndex = decrypted.indexOf('|')
          if (separatorIndex === -1) {
            throw new Error('Invalid data format')
          }

          const dimensions = decrypted.substring(0, separatorIndex)
          const pixels = decrypted.substring(separatorIndex + 1)

          // Parse dimensions
          const [width, height] = dimensions.split(',').map(Number)
          console.log('Hidden image dimensions:', width, 'x', height)

          if (!width || !height || width <= 0 || height <= 0) {
            throw new Error('Invalid image dimensions')
          }

          // Convert pixel data
          const pixelArray = pixels.split(',').map(Number)
          const expectedLength = width * height * 4

          if (pixelArray.length !== expectedLength) {
            throw new Error(`Invalid pixel data length: ${pixelArray.length} vs expected ${expectedLength}`)
          }

          // Reconstruct hidden image
          const hiddenCanvas = document.createElement('canvas')
          hiddenCanvas.width = width
          hiddenCanvas.height = height
          const hiddenCtx = hiddenCanvas.getContext('2d')
          const hiddenImageData = hiddenCtx.createImageData(width, height)

          // Set pixel data
          for (let i = 0; i < pixelArray.length; i++) {
            if (isNaN(pixelArray[i]) || pixelArray[i] < 0 || pixelArray[i] > 255) {
              pixelArray[i] = 0
            }
            hiddenImageData.data[i] = pixelArray[i]
          }

          hiddenCtx.putImageData(hiddenImageData, 0, 0)
          
          const revealedImage = hiddenCanvas.toDataURL('image/png')
          console.log('Successfully reconstructed hidden image')
          setDecodedImage(revealedImage)
          
        } catch (error) {
          console.error('Processing error:', error)
          alert(error.message)
          setDecodedImage(null)
        }
      }
      
      img.onerror = () => {
        console.error('Failed to load image')
        alert('Error loading the image. Please try again.')
        setDecodedImage(null)
      }
      
      img.src = coverImage
      
    } catch (error) {
      console.error('Decoding error:', error)
      alert(error.message)
      setDecodedImage(null)
    }
  }

  // Add this helper function at the top of your component
  const downloadImage = (dataUrl, fileName) => {
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.style.display = 'none'
        link.href = blobUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        setTimeout(() => {
          document.body.removeChild(link)
          window.URL.revokeObjectURL(blobUrl)
        }, 100)
      })
      .catch(err => {
        console.error('Download failed:', err)
        alert('Failed to download the image. Please try again.')
      })
  }

  // Add this function to extract the cover image
  const extractCoverImage = (encodedImageData) => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      return new Promise((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          
          // Clear LSB of first two color channels where data was hidden
          for (let i = 0; i < data.length; i += 4) {
            data[i] = data[i] & 254     // Clear LSB of red channel
            data[i + 1] = data[i + 1] & 254  // Clear LSB of green channel
          }
          
          ctx.putImageData(imageData, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        }
        
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = encodedImageData
      })
    } catch (error) {
      console.error('Error extracting cover:', error)
      throw new Error('Failed to extract cover image')
    }
  }

  return (
    <>
      <div className="container">
        <h1>Mystery Image</h1>
        
        <div className="mode-selector">
          <button 
            className={mode === 'encode' ? 'active' : ''} 
            onClick={() => setMode('encode')}
          >
            Transfigure
          </button>
          <button 
            className={mode === 'decode' ? 'active' : ''} 
            onClick={() => setMode('decode')}
          >
            Untransfigure
          </button>
        </div>

        {mode === 'encode' ? (
          <div className="encode-section">
            <div className="image-upload">
              <h3>Cover Image:</h3>
              <input type="file" accept="image/*" onChange={handleCoverImageUpload} />
              {coverImage && (
                <div className="image-preview">
                  <img src={coverImage} alt="Cover" className="preview" />
                  <button 
                    className="download-btn"
                    onClick={() => downloadImage(coverImage, 'cover-image.png')}
                  >
                    Download Cover Image
                  </button>
                </div>
              )}
            </div>
            
            <div className="image-upload">
              <h3>Secret Image:</h3>
              <input type="file" accept="image/*" onChange={handleSecretImageUpload} />
              {secretImage && (
                <div className="image-preview">
                  <img src={secretImage} alt="Secret" className="preview" />
                  <button 
                    className="download-btn"
                    onClick={() => downloadImage(secretImage, 'secret-image.png')}
                  >
                    Download Secret Image
                  </button>
                </div>
              )}
            </div>
            
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={handleEncode}>Hide Image</button>
            {resultImage && (
              <div className="result">
                <h3>Result Image:</h3>
                <img src={resultImage} alt="Result" className="preview" />
                <button 
                  className="download-btn"
                  onClick={() => downloadImage(resultImage, 'stego-image.png')}
                >
                  Download Encoded Image
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="decode-section">
            <div className="image-upload">
              <h3>Uncover mystery:</h3>
              <input type="file" accept="image/*" onChange={handleCoverImageUpload} />
              {coverImage && (
                <div className="image-preview">
                  <img src={coverImage} alt="To decode" className="preview" />
                  <button 
                    className="download-btn"
                    onClick={async () => {
                      try {
                        const extractedCover = await extractCoverImage(coverImage)
                        downloadImage(extractedCover, 'extracted-cover.png')
                      } catch (error) {
                        alert('Failed to extract cover image: ' + error.message)
                      }
                    }}
                  >
                    Download Cover Image Only
                  </button>
                </div>
              )}
            </div>
            
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={handleDecode} className="reveal-btn">Revelio</button>
            
            {decodedImage && (
              <div className="result">
                <h3>Hidden Image:</h3>
                <img src={decodedImage} alt="Decoded" className="preview" />
                <button 
                  className="download-btn"
                  onClick={() => downloadImage(decodedImage, 'revealed-image.png')}
                >
                  Download Hidden Image
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <footer className="footer">
        <div className="footer-content">
          <div className="project-links">
            <div className="links-container">
              <a 
                href="https://github.com/Sane-Sunil/Stego-canvas" 
                target="_blank" 
                rel="noopener noreferrer"
                className="project-link"
              >
                <span hidden>Source Code</span>
              </a>
              <a 
                href="/not-found" 
                className="project-link"
              >
                <img 
                  src="https://assets.vercel.com/image/upload/front/favicon/vercel/180x180.png" 
                  alt="Live Demo" 
                />
                <span>Live Demo</span>
              </a>
            </div>
          </div>
          <div className="creator-link">
            <a 
              href="https://github.com/SanTechBoard/" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub" />
              <span>SanTechBoard</span>
            </a>
          </div>
        </div>
      </footer>
    </>
  )
}

export default App
