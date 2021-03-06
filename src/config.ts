/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

export const PORT = Number(process.env.PORT) || 9000;
export const NODE_ENV = String(process.env.NODE_ENV || 'development').toLowerCase();
export const GQL_MAX_COST = Number(process.env.GQL_MAX_COST) || 1000;
export const ADVERTISED_HOST = process.env.ADVERTISED_HOST || 'http://localhost:9000';

// Elasticsearch config
export const ELASTICSEARCH_HOST = process.env.ELASTICSEARCH_HOST || 'http://localhost:9200';
export const ELASTICSEARCH_VAULT_SECRET_PATH = process.env
  .ELASTICSEARCH_VAULT_SECRET_PATH as string;
export const ELASTICSEARCH_USERNAME = process.env.ELASTICSEARCH_USERNAME;
export const ELASTICSEARCH_PASSWORD = process.env.ELASTICSEARCH_PASSWORD;
export const ELASTICSEARCH_CLIENT_TRUST_SSL_CERT =
  process.env.ELASTICSEARCH_CLIENT_TRUST_SSL_CERT === 'true';

export const ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX =
  process.env.ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX || 'donor_centric';

// Arranger configs
export const ARRANGER_FILE_CENTRIC_INDEX =
  process.env.ARRANGER_FILE_CENTRIC_INDEX || 'file_centric';
export const ARRANGER_PROJECT_ID = process.env.ARRANGER_PROJECT_ID || 'argo';

// Ego config
export const EGO_ROOT_REST = process.env.EGO_ROOT_REST || 'http://localhost:8081';
export const EGO_ROOT_GRPC = process.env.EGO_ROOT_GRPC || 'localhost:50051';
export const EGO_DACO_POLICY_NAME = process.env.EGO_DACO_POLICY_NAME || 'DACO';
export const EGO_VAULT_SECRET_PATH = process.env.EGO_VAULT_SECRET_PATH as string;
export const EGO_CLIENT_ID = process.env.EGO_CLIENT_ID;
export const EGO_CLIENT_SECRET = process.env.EGO_CLIENT_SECRET;

// Vault
export const USE_VAULT = process.env.USE_VAULT === 'true';
export const VAULT_TOKEN = process.env.VAULT_TOKEN as string;
export const VAULT_AUTH_METHOD = process.env.VAULT_AUTH_METHOD as 'token' | 'kubernetes';
export const VAULT_URL = (process.env.VAULT_URL as string) || 'http://localhost:8200';
export const VAULT_ROLE = process.env.VAULT_ROLE as string;

// Default ego public key value is the example value provided in the application.yml of the public overture repository
export const EGO_PUBLIC_KEY =
  process.env.EGO_PUBLIC_KEY ||
  `-----BEGIN PUBLIC KEY-----\r\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0lOqMuPLCVusc6szklNXQL1FHhSkEgR7An+8BllBqTsRHM4bRYosseGFCbYPn8r8FsWuMDtxp0CwTyMQR2PCbJ740DdpbE1KC6jAfZxqcBete7gP0tooJtbvnA6X4vNpG4ukhtUoN9DzNOO0eqMU0Rgyy5HjERdYEWkwTNB30i9I+nHFOSj4MGLBSxNlnuo3keeomCRgtimCx+L/K3HNo0QHTG1J7RzLVAchfQT0lu3pUJ8kB+UM6/6NG+fVyysJyRZ9gadsr4gvHHckw8oUBp2tHvqBEkEdY+rt1Mf5jppt7JUV7HAPLB/qR5jhALY2FX/8MN+lPLmb/nLQQichVQIDAQAB\r\n-----END PUBLIC KEY-----`;

// External service root
export const PROGRAM_SERVICE_ROOT = process.env.PROGRAM_SERVICE_ROOT || 'localhost:50052';
export const CLINICAL_SERVICE_ROOT = process.env.CLINICAL_SERVICE_ROOT || 'http://localhost:3000';
export const KAFKA_REST_PROXY_ROOT = process.env.KAFKA_REST_PROXY_ROOT || 'http://localhost:8085';
export const DONOR_AGGREGATOR_API_ROOT =
  process.env.DONOR_AGGREGATOR_API_ROOT || 'http://localhost:7000';

export const APP_DIR = __dirname;

// Helpdesk auth
export const JIRA_ADMIN_VAULT_CREDENTIALS_PATH = process.env
  .JIRA_ADMIN_VAULT_CREDENTIALS_PATH as string;
export const JIRA_REST_URI =
  process.env.JIRA_REST_URI || 'https://extsd.oicr.on.ca/rest/servicedeskapi';
export const JIRA_SERVICEDESK_ID = process.env.JIRA_SERVICEDESK_ID || '9';
export const JIRA_ADMIN_EMAIL = process.env.JIRA_ADMIN_EMAIL;
export const JIRA_ADMIN_PASS = process.env.JIRA_ADMIN_PASS;
export const JIRA_ORGANIZATION_ID = process.env.JIRA_ORGANIZATION_ID;

// RECAPTCHA CREDENTIALS
export const RECAPTCHA_SECRET_KEY = String(process.env.RECAPTCHA_SECRET_KEY);
export const RECAPTCHA_VAULT_SECRET_PATH = String(process.env.RECAPTCHA_VAULT_SECRET_PATH);
export const DEV_RECAPTCHA_DISABLED = process.env.DEV_RECAPTCHA_DISABLED === 'true';

// TSV download configs
export const DEFAULT_TSV_STREAM_CHUNK_SIZE =
  Number(process.env.DEFAULT_TSV_STREAM_CHUNK_SIZE) || 1000;

// Feature flags
export const FEATURE_HELP_DESK_ENABLED = process.env.FEATURE_HELP_DESK_ENABLED === 'true';
export const FEATURE_ARRANGER_SCHEMA_ENABLED =
  process.env.FEATURE_ARRANGER_SCHEMA_ENABLED === 'true';
export const FEATURE_STORAGE_API_ENABLED = process.env.FEATURE_STORAGE_API_ENABLED === 'true';
export const FEATURE_METADATA_ACCESS_CONTROL =
  process.env.FEATURE_METADATA_ACCESS_CONTROL === 'true';
