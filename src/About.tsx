import { GitHubMark, Icon } from './components/Icon'
import { ServiceIcon } from './components/ServiceNode'
import { PRICES_AS_OF, REGION } from './engine/prices'
import { services } from './engine/services'
import { REPO_URL } from './links'

const shortcuts: [string, string][] = [
  ['Undo / redo', '⌘Z / ⇧⌘Z'],
  ['Copy, cut, paste', '⌘C, ⌘X, ⌘V'],
  ['Duplicate', '⌘D'],
  ['Select all', '⌘A'],
  ['Delete selection', '⌫'],
  ['Pan', 'Scroll or Space + drag'],
  ['Zoom', 'Pinch or ⌘ + scroll'],
]

export function About() {
  const listed = services.filter((s) => !s.isSource && s.type !== 'custom')

  return (
    <div className="about">
      <header className="about-nav">
        <a className="brand" href="/">
          <img src="/favicon.svg" alt="" width={22} height={22} />
          cloudtally
        </a>
        <nav>
          <a className="button" href={REPO_URL} target="_blank" rel="noreferrer">
            <GitHubMark />
            GitHub
          </a>
          <a className="button primary" href="/">
            Open editor
          </a>
        </nav>
      </header>

      <main className="about-main">
        <section className="about-hero">
          <h1>See what your AWS architecture costs while you draw it.</h1>
          <p>
            Drag services onto a canvas, connect them, and set your traffic. cloudtally prices every service and connection
            and updates the monthly bill as you design.
          </p>
          <div className="about-actions">
            <a className="button primary large" href="/">
              Start designing
            </a>
            <a className="button large" href={REPO_URL} target="_blank" rel="noreferrer">
              <GitHubMark />
              Star on GitHub
            </a>
          </div>
          <video
            className="about-shot"
            src="/promo.mp4"
            poster="/promo-poster.jpg"
            aria-label="cloudtally in action: dragging services onto the canvas while the monthly cost updates"
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
          />
        </section>

        <section className="about-grid">
          <div>
            <h2>How it works</h2>
            <ol className="about-steps">
              <li>
                <strong>Set your traffic.</strong> Daily users and requests per user, in the header.
              </li>
              <li>
                <strong>Draw your design.</strong> Drag services from the sidebar and connect them.
              </li>
              <li>
                <strong>Tune each piece.</strong> Click a service or connection to change its size, fan-out or payload.
              </li>
              <li>
                <strong>Check the bill.</strong> The total updates live. Open <em>Scale</em> to see cost from 1k to 10M users.
              </li>
            </ol>
          </div>
          <div>
            <h2>How costs are calculated</h2>
            <ul className="about-list">
              <li>Traffic starts at Users and flows along each connection, multiplied by its calls per request.</li>
              <li>Each service turns the traffic it receives into billable units, like requests, GB-seconds or instance-hours.</li>
              <li>Connections add data transfer: internet egress and cross-AZ traffic.</li>
              <li>
                Prices are {REGION} on-demand list prices from the AWS Price List API, as of {PRICES_AS_OF}, refreshed weekly.
              </li>
            </ul>
            <p className="about-note">Estimates for comparing designs, not a quote.</p>
          </div>
        </section>

        <section>
          <h2>Services</h2>
          <ul className="about-services">
            {listed.map((s) => (
              <li key={s.type}>
                <ServiceIcon type={s.type} size={22} />
                {s.label}
              </li>
            ))}
            <li>
              <ServiceIcon type="custom" size={22} />
              Your own (custom pricing)
            </li>
          </ul>
        </section>

        <section className="about-grid">
          <div>
            <h2>Keyboard shortcuts</h2>
            <dl className="about-keys">
              {shortcuts.map(([action, keys]) => (
                <div key={action}>
                  <dt>{action}</dt>
                  <dd>{keys}</dd>
                </div>
              ))}
            </dl>
            <p className="about-note">Use Ctrl instead of ⌘ on Windows and Linux.</p>
          </div>
          <div>
            <h2>Open source</h2>
            <p>
              cloudtally is free and MIT licensed. Bug reports, new services and pricing fixes are welcome. Start with the{' '}
              <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">
                contributing guide
              </a>
              .
            </p>
            <a className="button" href={`${REPO_URL}/issues/new/choose`} target="_blank" rel="noreferrer">
              <Icon name="chart" />
              Request a service
            </a>
          </div>
        </section>
      </main>

      <footer className="about-footer">
        <span>MIT License</span>
        <span>
          Service icons are{' '}
          <a href="https://aws.amazon.com/architecture/icons/" target="_blank" rel="noreferrer">
            AWS Architecture Icons
          </a>
          . Not affiliated with Amazon Web Services.
        </span>
      </footer>
    </div>
  )
}
