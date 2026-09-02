import { QRCodeSVG } from 'qrcode.react'

export default function ShareTab() {
  const url = window.location.href.split('#')[0]
  return (
    <div className="center-panel">
      <h2>Share this app</h2>
      <p>Point a phone camera at the code — no typing, no app store.</p>
      <div className="qr-wrap">
        <QRCodeSVG value={url} size={220} level="M" />
      </div>
      <p>
        <a href={url}>{url.replace(/^https?:\/\//, '')}</a>
      </p>
    </div>
  )
}
