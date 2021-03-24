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
  ProgramDonorSummaryFilter,
  EsDonorDocumentField,
  DonorSummaryEntrySort,
  BaseQueryArguments,
  AnalysisType,
  EsAggs,
  ResultBucket,
  ResultBuckets,
} from './types';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX } from 'config';
import { UserInputError } from 'apollo-server-express';
import { convertStringToISODate, validateISODate } from 'utils/dateUtils';
import { ELASTICSEARCH_DATE_TIME_FORMAT } from '../../../constants/elasticsearch';
import { differenceInDays, sub as subDate, formatISO } from 'date-fns';
import logger from 'utils/logger';

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
> = esClient => async (source, args, context): Promise<ResultBucket[]> => {
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

  const daysInRange = differenceInDays(isoDateRangeTo, isoDateRangeFrom);
  if (daysInRange < bucketCount) {
    throw new UserInputError(`${ERROR_TITLE} Days in range must be greater than or equal to bucket count`, {
      dateRangeFrom,
      dateRangeTo
    });
  }

  const bucketDates = [...Array(bucketCount).keys()]
    .sort((a, b) => b - a)
    .map((bucketIndex: number) => subDate(isoDateRangeTo, 
      { days: Math.floor(daysInRange / bucketCount * bucketIndex) }
    ))
    .map((bucketDate: Date) => formatISO(bucketDate));

  const esQuery = esb
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
      .ranges(bucketDates.map(bucketDate => ({ to: bucketDate })))
    ));

  const esAggs: EsAggs = await esClient
    .search({ 
      index: ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX,
      body: esQuery,
    })
    .then(res => res.body.aggregations)
    .catch(err => {
      logger.error(`${ERROR_TITLE} Error reading data from Elasticsearch: `, err);
      return {} as EsAggs;
    });

  return Object.keys(esAggs).map((key) => ({
    title: key.split('Agg')[0],
    buckets: esAggs[key].buckets.map((bucket) => ({
      date: bucket.to_as_string,
      donors: bucket.doc_count
    }))
  }));
};

export default programDonorPublishedAnalysisByDateRangeResolver;
