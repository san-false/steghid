import { useNavigate } from 'react-router-dom'
import './NotFound.css'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <div className="not-found">
      <div className="not-found-content">
        <h1>What were you watching then?</h1>
        <button 
          className="go-back-btn"
          onClick={() => navigate('/')}
        >
          Go Back
        </button>
      </div>
    </div>
  )
}

export default NotFound
