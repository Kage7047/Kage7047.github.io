import Article from '../../components/Article.jsx'
import Code from '../../components/Code.jsx'

// Everything here comes from supply-chain-fortress CI (PR #2 and its three failing runs) and from
// Kyverno v1.19.2's source: pkg/webhooks/server.go, pkg/utils/runtime, pkg/cel/autogen/support.go.

const TOC = [
  { id: 'method', title: 'Three checks per attack' },
  { id: 'scale', title: 'failurePolicy: Fail, admitted anyway' },
  { id: 'guard', title: 'A guard Kyverno cannot switch off' },
  { id: 'omitempty', title: 'The guard’s own bug' },
  { id: 'hung', title: 'Unplugging Kyverno is harder than it looks' },
  { id: 'autogen', title: 'Closing one hole opened another' },
  { id: 'verifier', title: 'Who checks the checker' },
  { id: 'keeping', title: 'What I am keeping' },
]

const REPO = 'https://github.com/Kage7047/supply-chain-fortress'

export default function KyvernoFailsOpen({ route }) {
  return (
    <Article post={route.post} toc={TOC} readingMinutes={9}>
      <p>
        <a href={REPO}>supply-chain-fortress</a> ships one small Go service, and the whole path from its source to a
        running pod. The release workflow builds the image from pinned inputs, signs it keyless through GitHub&rsquo;s
        OIDC token, attaches an SBOM and SLSA provenance, and Kubernetes runs it only if all of that checks out:{' '}
        <a href="https://kyverno.io">Kyverno</a> verifies the signature and the SBOM, and a built-in
        ValidatingAdmissionPolicy refuses images from any other registry.
      </p>
      <p>
        None of that is new. What I wanted to know is whether it actually holds, so every defence in the repository comes
        with an attack that CI runs on every pull request. This post is about five things those attacks found that I would
        not have found by reading documentation, starting with the one I least expected: setting Kyverno&rsquo;s{' '}
        <code>failurePolicy</code> to <code>Fail</code> does not stop pods getting in when Kyverno is gone.
      </p>

      <h2 id="method">Three checks per attack</h2>
      <p>
        Each attack runs three ways, the same method I used for my <a href="/writing/features-hide-bugs/">Raft tests</a>.
        First the genuine image must be admitted, because a policy that refuses everything passes every attack test. Then the
        attack must be refused, and the refusal has to carry the message of the defence meant to stop it, not just any
        error. Last comes the control: the same attack in a namespace where that one defence is missing, which must be
        admitted. If the control is refused too, the test proves nothing about the defence.
      </p>
      <p>
        Every pod goes through real admission with <code>kubectl apply --dry-run=server</code> on a kind cluster, against
        the production policy files. A small script renders test copies that change only lines marked{' '}
        <code># render:</code>, such as the registry address and the signer, so the tests cannot drift into testing a
        lookalike.
      </p>

      <h2 id="scale">failurePolicy: Fail, admitted anyway</h2>
      <p>
        The test I wrote for &ldquo;Kyverno is down&rdquo; was simple. Scale Kyverno&rsquo;s admission controller to zero,
        wait for its pod to go, and submit an unsigned image. With <code>failurePolicy: Fail</code> the API server should
        refuse what it cannot check; the control namespace, with <code>Ignore</code>, should let it in.
      </p>
      <Code lang="text" caption="CI, first run">{`
FAIL a09   enforced   admitted   Kyverno down: unsigned image
FAIL p09   enforced   admitted   Kyverno down: the genuine image is refused too
ok   c09   fail-open  admitted   control: failurePolicy Ignore lets the unsigned image in
`}</Code>
      <p>
        Both namespaces admitted it. The debugging step that dumps webhook configurations on failure printed nothing at
        all: there were none left. The reason is in Kyverno&rsquo;s webhook server. When it shuts down, it asks whether
        it is &ldquo;going down&rdquo;, and if so it deletes every webhook configuration it manages:
      </p>
      <Code lang="go" caption="kyverno v1.19.2, pkg/utils/runtime and pkg/webhooks/server.go (shortened)">{`
func (c *runtime) IsGoingDown() bool {
    deployment, err := c.getDeployment()
    ...
    if deployment.GetDeletionTimestamp() != nil {
        return true
    }
    return *deployment.Spec.Replicas == 0
}

func (s *server) cleanup(ctx context.Context) {
    if s.runtime.IsGoingDown() {
        ...
        deleteVwc() // every ValidatingWebhookConfiguration Kyverno manages
        deleteMwc()
    }
}
`}</Code>
      <p>
        That is a deliberate choice, and a reasonable one: a policy engine that fails closed and then gets uninstalled
        would otherwise leave behind webhooks that block every pod in the cluster. But it changes what{' '}
        <code>failurePolicy: Fail</code> means. It covers a Kyverno that is deployed and cannot answer. It does not cover a
        Kyverno that was scaled to zero, because by the time anything is admitted there is no webhook left to fail. No
        error, no event, and pods are admitted unchecked.
      </p>
      <p>
        Scaling a deployment to zero is not exotic. It is what people do during an incident (&ldquo;is Kyverno the reason
        deploys are slow?&rdquo;), what a script with <code>--all</code> does, and what an autoscaler or a GitOps tool can do by
        mistake. Anyone with <code>deployments/scale</code> in the <code>kyverno</code> namespace can switch off every image
        check in the cluster, and the person who does it may not know they have.
      </p>

      <h2 id="guard">A guard Kyverno cannot switch off</h2>
      <p>
        Kyverno cannot protect itself from this: when it is gone, its rules are gone. Kubernetes&rsquo; built-in
        ValidatingAdmissionPolicy is evaluated inside the API server, so it does not depend on Kyverno being up. The guard
        refuses deleting Kyverno&rsquo;s admission controller and scaling it below one replica:
      </p>
      <Code lang="yaml" caption="policy/protect-kyverno.yaml (shortened)">{`
matchConstraints:
  resourceRules:
    - apiGroups: [apps]
      apiVersions: [v1]
      operations: [UPDATE, DELETE]
      resources: [deployments, deployments/scale]
      resourceNames: [kyverno-admission-controller]
validations:
  - expression: request.operation != 'DELETE'
    message: Kyverno's admission controller cannot be deleted
  - expression: >-
      request.operation == 'DELETE' ||
      (has(object.spec.replicas) && object.spec.replicas >= 1)
    message: Kyverno's admission controller cannot be scaled to zero ...
`}</Code>
      <p>
        Taking Kyverno down on purpose now means deleting the guard&rsquo;s binding first, which is a deliberate, audited
        step rather than a side effect of <code>kubectl scale</code>. The control for this attack does exactly that, and
        it is the most convincing line in the test output:
      </p>
      <Code lang="text" caption="CI">{`
ok   a14   kyverno    denied     scale Kyverno to zero (an incident, a script, an autoscaler)
ok   a14d  kyverno    denied     delete Kyverno's Deployment
ok   c14   enforced   admitted   control: no guard, Kyverno scaled to zero (0 webhooks left): unsigned image admitted
`}</Code>
      <p>
        Scaling is not the only way to remove the webhooks. Anyone allowed to delete webhook configurations can delete
        Kyverno&rsquo;s directly, and Kyverno can do nothing about it: the API server never sends requests for webhook
        configurations to admission webhooks, so a webhook cannot lock itself in place. Built-in policies are not exempt.
        A second ValidatingAdmissionPolicy refuses any change to a configuration labelled{' '}
        <code>webhook.kyverno.io/managed-by</code> unless it comes from Kyverno&rsquo;s own service account, which still
        needs to manage them:
      </p>
      <Code lang="text" caption="CI">{`
ok   a15   cluster    denied     delete Kyverno's webhook configurations
ok   ok6   cluster    admitted   Kyverno itself may still delete them
ok   c15   cluster    admitted   control: no guard, a cluster admin deletes Kyverno's webhook configurations
`}</Code>
      <p>
        None of this stops a determined cluster admin, who can delete the guards first. It turns switching Kyverno off
        from a side effect into a two-step, deliberate act that shows up in the audit log.
      </p>

      <h2 id="omitempty">The guard&rsquo;s own bug</h2>
      <p>
        The first version of the guard let <code>kubectl scale --replicas=0</code> straight through. Deleting the
        deployment was refused; scaling it was not. Its expression was:
      </p>
      <Code lang="text" caption="first version">{`
request.operation == 'DELETE' || !has(object.spec.replicas) || object.spec.replicas >= 1
`}</Code>
      <p>
        The idea was that a missing <code>replicas</code> means &ldquo;use the default&rdquo;, which is one. That is true
        of a Deployment. But <code>kubectl scale</code> does not send a Deployment; it sends a <code>Scale</code> object to
        the <code>/scale</code> subresource, and in <code>Scale</code> the field is a plain integer tagged{' '}
        <code>omitempty</code>. Zero is the one value that is never serialised. So the request that asks for zero
        replicas arrives with no <code>replicas</code> at all, and <code>!has()</code> waved it through. Without the
        attack test, this guard would have been decoration.
      </p>

      <h2 id="hung">Unplugging Kyverno is harder than it looks</h2>
      <p>
        With scaling ruled out, the test for <code>failurePolicy</code> needed a Kyverno that is deployed but cannot
        answer. My first attempt pointed its Service at a label no pod has. The endpoints emptied, and Kyverno kept
        answering: the unsigned image was refused by Kyverno itself, and the genuine one admitted. The API server keeps an
        open connection to the webhook, and an established connection does not care that the Service no longer selects the
        pod behind it.
      </p>
      <p>
        What works is freezing the process. The test sends <code>SIGSTOP</code> to Kyverno from the kind node, so the
        webhook hangs until its 15 second timeout. The liveness probe would restart it after 35 to 65 seconds, so the three
        requests run at the same time and the whole test fits inside one timeout:
      </p>
      <Code lang="text" caption="CI">{`
ok   a09   enforced   denied     Kyverno hung: unsigned image
ok   p09   enforced   denied     Kyverno hung: the genuine image is refused too
ok   c09   fail-open  admitted   control: Kyverno hung, failurePolicy Ignore lets the unsigned image in
`}</Code>
      <p>
        The middle line is the price of failing closed, and I wanted it in the output on purpose. While Kyverno is hung,
        nothing deploys, including your own fix.
      </p>

      <h2 id="autogen">Closing one hole opened another</h2>
      <p>
        An earlier attack showed that <code>kubectl debug</code> gets past most published policies. It adds an ephemeral
        container to a pod that is already running, through the <code>pods/ephemeralcontainers</code> subresource, and a
        policy that matches only <code>pods</code> never sees it. So the policy matched both. Then I added a test that puts
        the unsigned image in a Deployment, expecting Kyverno&rsquo;s autogen to refuse it at <code>kubectl apply</code>.
        The Deployment was admitted.
      </p>
      <Code lang="go" caption="kyverno v1.19.2, pkg/cel/autogen/support.go (shortened)">{`
// CanAutoGen returns false if ... the matching logic matches more than
// one resource and it's not pods
if len(rule.Resources) != 1 || rule.Resources[0] != "pods" {
    return false
}
`}</Code>
      <p>
        Autogen, the feature that writes the same checks for Deployments, Jobs and the other pod controllers, only runs
        when a policy matches exactly <code>pods</code>. Adding the subresource turned it off, without a warning. The pods
        themselves would still be refused, but only as a ReplicaSet that quietly never scales up, which is a worse failure
        to debug than an error at <code>kubectl apply</code>. The fix is two policies: one that matches only{' '}
        <code>pods</code> and gets autogen, and one for the debug subresource.
      </p>

      <h2 id="verifier">Who checks the checker</h2>
      <p>
        Kyverno decides what runs, so a backdoored Kyverno would make every other check meaningless. The cluster now
        installs it only from two digests, after verifying them. Kyverno&rsquo;s v1.19.2 images have no plain cosign
        signature; what they carry is SLSA provenance signed by{' '}
        <a href="https://github.com/slsa-framework/slsa-github-generator">slsa-github-generator</a>&rsquo;s reusable
        workflow. That detail matters, because the certificate&rsquo;s subject is the generator&rsquo;s workflow, which is
        the same for every project that calls it. Who actually built the image is in two other claims: the calling
        repository and its ref.
      </p>
      <p>
        The tests check this against real images. Another project&rsquo;s image with genuine provenance from the same
        generator passes a check on the subject alone, and is refused once the repository is pinned. A genuine but older
        Kyverno release passes a check on the repository, and is refused once the tag is pinned. A modified copy of
        Kyverno carrying Kyverno&rsquo;s real provenance document, re-signed by my own CI, passes &ldquo;signed by a GitHub
        workflow&rdquo; and is refused by the full check.
      </p>
      <p>
        Provenance alone is still not enough. Kyverno&rsquo;s other images, the CLI and the background controller, have
        the same repository and tag in their provenance. A check by provenance would accept either of them in place of the
        admission controller, so the digests are pinned as well, and the cluster setup fails if any Kyverno pod runs
        anything else.
      </p>

      <h2 id="keeping">What I am keeping</h2>
      <ul>
        <li>
          <strong>Read failure settings as claims, then test them.</strong> <code>failurePolicy: Fail</code> is true for one
          way of being down and false for the most common one.
        </li>
        <li>
          <strong>Test the guard too.</strong> The first version of the guard against scale-to-zero did not guard against
          scale-to-zero, because of how a zero is serialised.
        </li>
        <li>
          <strong>A fix can switch off a neighbouring feature without a word.</strong> Matching one more subresource disabled
          autogen. Only a test of the neighbour shows it.
        </li>
        <li>
          <strong>A shared signer proves nothing by itself.</strong> When a reusable workflow signs for everyone, check who
          called it, and from which ref.
        </li>
      </ul>
      <p>
        All 31 cluster checks, eight checks on Kyverno&rsquo;s own images, and five workflow attacks run on every pull
        request at <a href={REPO}>github.com/Kage7047/supply-chain-fortress</a>. To verify a released image yourself:
      </p>
      <Code lang="shell" caption="shell">{`
cosign verify ghcr.io/kage7047/supply-chain-fortress/app:<commit sha> \\
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \\
  --certificate-identity https://github.com/Kage7047/supply-chain-fortress/.github/workflows/release.yml@refs/heads/main
`}</Code>
    </Article>
  )
}
