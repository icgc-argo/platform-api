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

import 'babel-polyfill';
import { FILE_METADATA_FIELDS, FILE_EMBARGO_STAGE } from 'utils/commonTypes/EsFileCentricDocument';
import egoTokenUtils from 'utils/egoTokenUtils';
import { UserProgramMembershipAccessLevel } from '@icgc-argo/ego-token-utils';
import { EgoJwtData } from '@icgc-argo/ego-token-utils/dist/common';
import {
	ArrangerFilterFieldOperation,
	ArrangerFilter,
	ArrangerFilterNode,
} from './arrangerFilterTypes';
import { uniq } from 'lodash';
import logger from '../../utils/logger';

const FILE_EMBARGO_FILTER_FIELD = FILE_METADATA_FIELDS['meta.embargo_stage'];
const FILE_STUDY_FILTER_FIELD = FILE_METADATA_FIELDS['meta.study_id'];

const emptyFilter = (): ArrangerFilter => ({
	op: 'and',
	content: [],
});

/* Logical operator shorthands */
const all = (conditions: ArrangerFilterNode[]): ArrangerFilter => ({
	op: 'and',
	content: [...conditions],
});
const not = (conditions: ArrangerFilterNode[]): ArrangerFilter => ({
	op: 'not',
	content: [...conditions],
});
const match = (
	field: keyof typeof FILE_METADATA_FIELDS,
	values: string[],
): ArrangerFilterFieldOperation => ({
	op: 'in',
	content: {
		field,
		value: values,
	},
});
/*******************************/

const getAccessControlFilter = (userJwtData: EgoJwtData | null): ArrangerFilter => {
	const userPrograms: string[] = userJwtData
		? uniq(egoTokenUtils.getReadableProgramDataNames(userJwtData.context.scope))
		: [];
	const programMembershipAccessLevel: UserProgramMembershipAccessLevel = userJwtData
		? egoTokenUtils.getProgramMembershipAccessLevel({
				permissions: userJwtData.context.scope,
		  })
		: UserProgramMembershipAccessLevel.PUBLIC_MEMBER;
	/* common filters */
	const isFromOtherPrograms = not([match(FILE_STUDY_FILTER_FIELD, userPrograms)]);
	const isProgramOnly = match(FILE_EMBARGO_FILTER_FIELD, [FILE_EMBARGO_STAGE.OWN_PROGRAM]);
	const isProgramOrFullMember = match(FILE_EMBARGO_FILTER_FIELD, [
		FILE_EMBARGO_STAGE.OWN_PROGRAM,
		FILE_EMBARGO_STAGE.FULL_PROGRAMS,
	]);
	const isPublicRelease = match(FILE_EMBARGO_FILTER_FIELD, [FILE_EMBARGO_STAGE.PUBLIC]);
	/******************/

	const userPermissionToQueryMap: {
		[accessLevel in UserProgramMembershipAccessLevel]: ArrangerFilter;
	} = {
		DCC_MEMBER: emptyFilter(),
		FULL_PROGRAM_MEMBER: not([all([isFromOtherPrograms, isProgramOnly])]),
		ASSOCIATE_PROGRAM_MEMBER: not([all([isFromOtherPrograms, isProgramOrFullMember])]),
		PUBLIC_MEMBER: all([isPublicRelease]),
	};
	const output = userPermissionToQueryMap[programMembershipAccessLevel];

	return output;
};

export default getAccessControlFilter;
