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

export type TsvFileSchema<Source> = Array<{ header: string; getter: (source: Source) => string }>;

export type EsFileDocument = {
  analysis: {
    analysis_id: string;
    analysis_type: string;
    analysis_version: number;
    experiment: {
      experimental_strategy: string;
      platform: string;
    };
    workflow: {
      workflow_name: string;
      workflow_version: string;
    };
  };
  data_type: string;
  donors: Array<{
    donor_id: string;
    gender: string;
    specimens: Array<{
      samples: Array<{
        matched_normal_submitter_sample_id: string;
        sample_id: string;
        sample_type: string;
        submitter_sample_id: string;
      }>;
      specimen_id: string;
      specimen_tissue_source: string;
      specimen_type: string;
      submitter_specimen_id: string;
      tumour_normal_designation: string;
    }>;
    submitter_donor_id: string;
  }>;
  file: {
    index_file?: {
      file_type: string;
      md5sum: string;
      name: string;
      object_id: string;
      size: number;
    };
    md5sum: string;
    name: string;
    size: number;
  };
  file_access: string;
  file_autocomplete: string;
  file_type: string;
  object_id: string;
  repositories: Array<{
    code: string;
    country: string;
    name: string;
    organization: string;
    url: string;
  }>;
  study_id: string;
  variant_class: string;
};
