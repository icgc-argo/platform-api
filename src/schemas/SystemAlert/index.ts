/*
 * Copyright (c) 2024 The Ontario Institute for Cancer Research. All rights reserved
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

import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import { createCheckers } from 'ts-interface-checker';

import logger from '@/utils/logger';

import systemAlertTI from './systemAlert-ti';

const { SystemAlertTI } = createCheckers(systemAlertTI);

// NOTE: we're validating system alerts at runtime with JavaScript,
// using TS interfaces/types and the "ts-interface-checker" library,
// rather than validating with TypeScript at buildtime.

// this is to avoid breaking the build if an alert is invalid.
// there's no other checks on alert data,
// because it's in an env variable, not a database.

// if an alert is invalid, the error will be logged,
// the build will continue, and valid system alerts will still be served.

interface SystemAlert {
	dismissable: boolean;
	id: string;
	level: 'error' | 'info' | 'warning';
	message?: string;
	title: string;
}

type AllowedFields = keyof SystemAlert;

// deliberately not typed to avoid throwing TS errors
// if a system alert includes extra fields.
const allowedFields = ['dismissable', 'id', 'level', 'message', 'title'];

const logError = (message: string, name: string) => {
	logger.debug(`Banner validation - ${name} - ${message}`);
};

const getSystemAlerts = () => {
	logger.info('Attempting to gather system alert banners');

	try {
		const alertsStr = process.env.SYSTEM_ALERTS;
		const alertsParsed = [].concat(alertsStr ? JSON.parse(alertsStr) : {});

		const alertsValidated = alertsParsed.reduce(
			(acc, curr) => ({
				...acc,
				...(SystemAlertTI.test(curr) ? { valid: [...acc.valid, curr] } : { invalid: [...acc.invalid, curr] }),
			}),
			{ valid: [], invalid: [] },
		);

		alertsValidated.invalid.forEach((alert: any) => {
			// check() will throw errors on invalid system alerts.
			SystemAlertTI.check(alert);
		});

		return alertsValidated.valid.map((alert: SystemAlert) =>
			Object.keys(alert)
				.filter((key) => allowedFields.includes(key))
				.reduce((acc, curr: AllowedFields) => ({ ...acc, [curr]: alert[curr] }), {} as SystemAlert),
		);
	} catch (error) {
		logError(error.message, error.name);

		return [];
	}
};

const alertsArray = getSystemAlerts();

logger.info(alertsArray?.length ? `Banners to display: ${JSON.stringify(alertsArray)}` : `No banners to display`);
console.log('\n');

const typeDefs = gql`
	type SystemAlert {
		dismissable: Boolean!
		id: ID!
		level: String!
		message: String
		title: String!
	}
	type Query {
		systemAlerts: [SystemAlert]
	}
`;

const resolvers = {
	Query: {
		systemAlerts: () => alertsArray,
	},
};

export default makeExecutableSchema({
	typeDefs,
	resolvers,
});
