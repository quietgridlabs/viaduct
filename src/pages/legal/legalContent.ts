/**
 * Community edition Terms / Privacy — template, not legal advice.
 * Cloud-hosted product terms live on c4.quietgridlabs.com.
 */

export const COMPANY_NAME = 'Quiet Grid Labs';
export const COMPANY_LEGAL_NAME = 'Quiet Grid Labs co.';
export const COMPANY_ADDRESS = 'Žemaitės gatvė 5c, Vilnius, Lithuania';
export const GOVERNING_LAW = 'the Republic of Lithuania';
export const CONTACT_EMAIL = 'support@quietgridlabs.com';

export const LEGAL_UPDATED = '12 September 2026';

export type LegalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] };

export type LegalSection = {
  id: string;
  heading: string;
  blocks: LegalBlock[];
};

const p = (text: string): LegalBlock => ({ kind: 'p', text });
const ul = (items: string[]): LegalBlock => ({ kind: 'ul', items });

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    heading: '1. The agreement',
    blocks: [
      p(
        `These terms are between you and ${COMPANY_LEGAL_NAME} ("${COMPANY_NAME}", "we", "us"), registered at ${COMPANY_ADDRESS}, and they cover Viaduct Community — the local browser editor distributed from this open-core repository.`
      ),
      p(
        'The hosted product at c4.quietgridlabs.com (Viaduct Cloud) has its own terms on that site. Using Cloud is a separate agreement.'
      ),
      p('By running or using the Community editor you accept these terms.'),
    ],
  },
  {
    id: 'service',
    heading: '2. What Community does',
    blocks: [
      p(
        'Viaduct Community lets you design C4 architecture diagrams, attach documentation and sequences, model API contracts and Magic flows, and keep the model in your browser or export it as JSON.'
      ),
      p(
        'Community does not require an account. Models stay on your machine unless you export or otherwise send them yourself.'
      ),
    ],
  },
  {
    id: 'license',
    heading: '3. Software licence',
    blocks: [
      p(
        'The Community source code is licensed under the Business Source License 1.1 (see LICENSE in the repository). Additional Use Grant and Change Date are defined there.'
      ),
      p(
        'You must not use the Licensed Work to offer a competing hosted multi-tenant C4 modelling service as described in LICENSE.'
      ),
    ],
  },
  {
    id: 'your-content',
    heading: '4. Your content',
    blocks: [
      p('Your models remain yours. We claim no ownership of locally stored or exported models.'),
      p(
        'If you later upload content to Viaduct Cloud, Cloud terms and privacy apply to that copy.'
      ),
    ],
  },
  {
    id: 'acceptable-use',
    heading: '5. Acceptable use',
    blocks: [
      p('Do not use Viaduct Community to:'),
      ul([
        'break the law, or infringe anyone’s rights;',
        'store or distribute malware, or content you have no right to;',
        'misrepresent Community software as an official Quiet Grid Labs hosted service.',
      ]),
    ],
  },
  {
    id: 'disclaimer',
    heading: '6. No warranty',
    blocks: [
      p(
        'Community is provided “as is”. To the extent permitted by law we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement.'
      ),
    ],
  },
  {
    id: 'liability',
    heading: '7. Liability',
    blocks: [
      p(
        `To the extent permitted by ${GOVERNING_LAW}, ${COMPANY_NAME} is not liable for indirect, incidental, or consequential damages arising from use of Community software.`
      ),
    ],
  },
  {
    id: 'contact',
    heading: '8. Contact',
    blocks: [p(`Questions: ${CONTACT_EMAIL}.`)],
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: 'scope',
    heading: '1. Scope',
    blocks: [
      p(
        'This notice covers Viaduct Community when you run it yourself (browser local editor). It does not cover Viaduct Cloud at c4.quietgridlabs.com — see the privacy policy there.'
      ),
    ],
  },
  {
    id: 'local-data',
    heading: '2. What stays on your device',
    blocks: [
      p(
        'The editor stores the architecture model in browser storage (for example localStorage). Cleared site data removes it. We cannot recover it.'
      ),
      p(
        'Optional UI preferences (theme, tags) may also stay in local storage. No account is created for Community.'
      ),
    ],
  },
  {
    id: 'no-server',
    heading: '3. No Community backend',
    blocks: [
      p(
        'The default Community build does not send your model to Quiet Grid Labs servers. If you self-host behind a reverse proxy or analytics you configure yourself, that is under your control.'
      ),
    ],
  },
  {
    id: 'contact',
    heading: '4. Contact',
    blocks: [p(`Privacy questions: ${CONTACT_EMAIL}.`)],
  },
];
