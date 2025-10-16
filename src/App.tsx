import ContentManager from './ContentManager'
import InstallPWABanner from './components/InstallPWABanner'
import SplashScreen from './components/SplashScreen'
import './App.css'

function App() {
  return (
    <>
      <SplashScreen />
      <ContentManager />
      <InstallPWABanner />
    </>
  )
}

export default App
