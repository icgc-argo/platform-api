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

import esb from 'elastic-builder';
import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import {
  DonorSummaryEntry,
  ProgramDonorSummaryFilter,
  ElasticsearchDonorDocument,
  EsDonorDocumentField,
  DonorSummaryEntrySort,
  DonorMolecularDataProcessingStatus,
  DonorMolecularDataReleaseStatus,
  BaseQueryArguments,
  AnalysisType,
} from './types';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX } from 'config';
import { UserInputError } from 'apollo-server-express';
import { convertStringToISODate, validateISODate } from 'utils/dateUtils';
import { ELASTICSEARCH_DATE_TIME_FORMAT } from '../../../constants/elasticsearch';
import { differenceInDays } from 'date-fns';

const esAggFields = {
  'clinical': [ 'createdAt' ], // TODO
  'molecular': [
    'alignment',
    'mutect',
    'rawReads',
    'sangerVcs',
  ],
};

const ERROR_TITLE = 'ProgramDonorPublishedAnalysisByDateRange:'

const esMolecularAggField = "FirstPublishedAt";

const programDonorPublishedAnalysisByDateRangeResolver: (
  esClient: Client,
) => GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  BaseQueryArguments & {
    // already have program short name
    analysisType: AnalysisType;
    bucketCount: number;
    dateRangeFrom: string;
    dateRangeTo: string;
    // old args
    // keeping these temporarily so the app doesn't crash
    first: number;
    offset: number;
    sorts: DonorSummaryEntrySort[];
    filters: ProgramDonorSummaryFilter[];
  }
> = esClient => async (source, args, context): Promise<DonorSummaryEntry[]> => {
  const { analysisType, bucketCount, dateRangeTo, dateRangeFrom, programShortName } = args;

  const esAggFieldString = analysisType === 'molecular' ? esMolecularAggField : '';

  const areDatesValid = validateISODate(dateRangeFrom) && validateISODate(dateRangeTo);
  if (!areDatesValid) {
    throw new UserInputError(`${ERROR_TITLE} Dates must be in ISO format`, {
      dateRangeFrom,
      dateRangeTo
    });
  }

  const isoDateRangeFrom = convertStringToISODate(dateRangeFrom);
  const isoDateRangeTo = convertStringToISODate(dateRangeTo);

  const daysInRange = differenceInDays(isoDateRangeFrom, isoDateRangeTo);
  if (daysInRange < bucketCount) {
    throw new UserInputError(`${ERROR_TITLE} Days in range must be greater than or equal to bucket count`, {
      dateRangeFrom,
      dateRangeTo
    });
  }

  const bucketsTemp = ['01-10-2020'];
  // console.log(esAggFields[analysisType])

  const newEsQuery = esb
    .requestBodySearch()
    .size(0)
    .query(
      esb.boolQuery()
        .filter(esb.termQuery(EsDonorDocumentField.programId, programShortName))
        .should(esAggFields[analysisType]
          .map(field => esb.existsQuery(`${field}${esAggFieldString}`)))
        .minimumShouldMatch(1)
    )
    .aggs(esAggFields[analysisType].map(field => esb
      .dateRangeAggregation(`${field}Agg`, `${field}${esAggFieldString}`)
      .format(ELASTICSEARCH_DATE_TIME_FORMAT)
      .ranges(bucketsTemp.map(bucket => ({ to: bucket })))
    ));

  const newEsQueryString = JSON.stringify(newEsQuery);
  // console.log('🤖🤖🤖🤖🤖🤖🤖', newEsQueryString);
  

  const esQuery = esb
    .requestBodySearch()
    .query(
      esb.boolQuery().must([
        //using an array to accommodate filters in the future
        esb.matchQuery(EsDonorDocumentField.programId, programShortName),
      ]),
    )
    .sorts(args.sorts.map(({ field, order }) => esb.sort(field, order)))
    .from(args.offset)
    .size(args.first);

  type EsHits = Array<{
    _source: ElasticsearchDonorDocument;
  }>;

  const esHits: EsHits = await esClient
    .search({ 
      index: ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX,
      body: esQuery,
    })
    .then(res => res.body.hits.hits)
    .catch(err => {
      logger.error('error reading data from Elasticsearch: ', err);
      return [] as EsHits;
    });
  // console.log('👾👾👾👾👾👾', esHits);
  
  return esHits
    .map(({ _source }) => _source)
    .map(
      doc =>
        ({
          id: `${programShortName}::${doc.donorId}`,
          programShortName: doc.programId,
          alignmentsCompleted: doc.alignmentsCompleted,
          alignmentsFailed: doc.alignmentsFailed,
          alignmentsRunning: doc.alignmentsRunning,
          donorId: doc.donorId,
          processingStatus: doc.processingStatus || DonorMolecularDataProcessingStatus.REGISTERED,
          programId: doc.programId,
          publishedNormalAnalysis: doc.publishedNormalAnalysis,
          publishedTumourAnalysis: doc.publishedTumourAnalysis,
          registeredNormalSamples: doc.registeredNormalSamples,
          registeredTumourSamples: doc.registeredTumourSamples,
          releaseStatus: doc.releaseStatus || DonorMolecularDataReleaseStatus.NO_RELEASE,
          sangerVcsCompleted: doc.sangerVcsCompleted,
          sangerVcsFailed: doc.sangerVcsFailed,
          sangerVcsRunning: doc.sangerVcsRunning,
          mutectCompleted: doc.mutectCompleted,
          mutectRunning: doc.mutectRunning,
          mutectFailed: doc.mutectFailed,
          submittedCoreDataPercent: doc.submittedCoreDataPercent,
          submittedExtendedDataPercent: doc.submittedExtendedDataPercent,
          submitterDonorId: doc.submitterDonorId,
          validWithCurrentDictionary: doc.validWithCurrentDictionary,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
          alignmentFirstPublishedDate: new Date(doc.alignmentFirstPublishedDate),
          fakeFirstPublishedDate: new Date(doc.fakeFirstPublishedDate),
          mutectFirstPublishedDate: new Date(doc.mutectFirstPublishedDate),
          rawReadsFirstPublishedDate: new Date(doc.rawReadsFirstPublishedDate),
          sangerVcsFirstPublishedDate: new Date(doc.sangerVcsFirstPublishedDate),
        } as DonorSummaryEntry),
    );
};

export default programDonorPublishedAnalysisByDateRangeResolver;
