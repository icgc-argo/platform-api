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

import esb, { Query } from 'elastic-builder';
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
  coreDataPercentAggregationValue,
  registeredSamplePairsValue,
} from './types';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX } from 'config';
import { UserInputError } from 'apollo-server-express';
import logger from 'utils/logger';

type DonorEntriesResolverType = GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  BaseQueryArguments & {
    first: number;
    offset: number;
    sorts: DonorSummaryEntrySort[];
    filters: ProgramDonorSummaryFilter[];
  }
>;

const programDonorSummaryEntriesResolver: (
  esClient: Client,
) => DonorEntriesResolverType = esClient => async (
  source,
  args,
  context,
): Promise<DonorSummaryEntry[]> => {
  const { programShortName } = args;

  const MAXIMUM_SUMMARY_PAGE_SIZE = 500;
  if (args.first > MAXIMUM_SUMMARY_PAGE_SIZE) {
    throw new UserInputError(`Max page size of ${MAXIMUM_SUMMARY_PAGE_SIZE} exceeded`, {
      first: args.first,
    });
  }

  const queries : Query[] = [];
  queries.push(esb.termsQuery(EsDonorDocumentField.programId, programShortName));

  args.filters.map(filter => {
    const field = filter.field;

    if (field === EsDonorDocumentField.combinedDonorId && filter.values.length > 0) {
      // use wildcard query for donor_id and submitter_donor_id partial match
      const donorIdQueries: Query[] =[];
      for (const value of filter.values) {
        const regex = `*${value.toLowerCase()}*`;
        const wildcardQuery = esb.wildcardQuery(EsDonorDocumentField.combinedDonorId, regex);
        donorIdQueries.push(wildcardQuery);
      }
      const boolQuery = esb.boolQuery().should(donorIdQueries);
      queries.push(boolQuery);
    }

    if (field === EsDonorDocumentField.coreDataPercentAggregation && filter.values.length > 0) {
      const corePercentqueries: Query[] = [];
      for (const value of filter.values) {
        switch (value) {
          case coreDataPercentAggregationValue.COMPLETE:
            corePercentqueries.push(esb.matchQuery(EsDonorDocumentField.submittedCoreDataPercent, '1'));
            break;
          case coreDataPercentAggregationValue.INCOMPLETE:
            corePercentqueries.push(esb.rangeQuery(EsDonorDocumentField.submittedCoreDataPercent).gt(0).lt(1))
            break;
          case coreDataPercentAggregationValue.NO_DATA:
            corePercentqueries.push(esb.matchQuery(EsDonorDocumentField.submittedCoreDataPercent, "0"))
            break;
          default:
            break;
        }
      }
      const boolQuery = esb.boolQuery().should(corePercentqueries);
      queries.push(boolQuery);
    }

    if (field === EsDonorDocumentField.registeredSamplePairs && filter.values.length > 0) {
      const sampleQueries: Query[] = [];
      for (const value of filter.values) {
        switch (value) {
          case registeredSamplePairsValue.INVALID:
            const shouldQueries: Query[] = [];
            shouldQueries.push(esb.rangeQuery(EsDonorDocumentField.registeredNormalSamples).lte(0));
            shouldQueries.push(esb.rangeQuery(EsDonorDocumentField.registeredTumourSamples).lte(0));
            sampleQueries.push(esb.boolQuery().should(shouldQueries));
            break;
          case registeredSamplePairsValue.VALID:
            const mustQueries: Query[] = [];
            mustQueries.push(esb.rangeQuery(EsDonorDocumentField.registeredNormalSamples).gte(1));
            mustQueries.push(esb.rangeQuery(EsDonorDocumentField.registeredTumourSamples).gte(1));
            sampleQueries.push(esb.boolQuery().must(mustQueries));
            break;
        }
      }
      const boolQuery = esb.boolQuery().should(sampleQueries);
      queries.push(boolQuery);
    }
  });

  const esQuery = esb
    .requestBodySearch()
    .query(
      esb.boolQuery().must( queries ),
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
        } as DonorSummaryEntry),
    );
};

export default programDonorSummaryEntriesResolver;
