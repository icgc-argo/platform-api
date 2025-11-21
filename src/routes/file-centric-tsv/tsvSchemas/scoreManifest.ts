/*
 * Copyright (c) 2022 The Ontario Institute for Cancer Research. All rights reserved
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

import flatMap from 'lodash/flatMap';
import { TsvFileSchema } from 'utils/commonTypes/tsv-schema';
import { EsFileDocument } from '../types';

const manifestFileFields: TsvFileSchema<EsFileDocument> = [
	{
		header: 'repository_code',
		getter: (fileObj) => fileObj.repositories.map(({ code }) => code).join('|'),
	},
	{ header: 'analysis_id', getter: (fileObj) => fileObj.analysis.analysis_id },
	{ header: 'object_id', getter: (fileObj) => fileObj.object_id },
	{ header: 'file_type', getter: (fileObj) => fileObj.file_type },
	{ header: 'file_name', getter: (fileObj) => fileObj.file.name },
	{ header: 'file_size', getter: (fileObj) => String(fileObj.file.size) },
	{ header: 'md5sum', getter: (fileObj) => fileObj.file.md5sum },
	{
		header: 'index_object_id',
		getter: (fileObj) => fileObj.file.index_file?.object_id || '',
	},
	{
		header: 'donor_id',
		getter: (fileObj) => fileObj.donors.map(({ donor_id }) => donor_id).join('|'),
	},
	{
		header: 'sample_id(s)',
		getter: (fileObj) =>
			flatMap(
				fileObj.donors.map(({ specimens }) =>
					specimens.map(({ samples }) => samples.map(({ sample_id }) => sample_id)),
				),
			).join('|'),
	},
	{ header: 'program_id', getter: (fileObj) => fileObj.study_id },
];

export default manifestFileFields;
