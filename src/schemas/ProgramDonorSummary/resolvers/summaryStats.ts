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

//@ts-ignore no type defs
import stringify from 'json-stringify-deterministic';
import esb from 'elastic-builder';
import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import {
  ProgramDonorSummaryStats,
  ProgramDonorSummaryFilter,
  ProgramDonorSummaryStatsGqlResponse,
  EsDonorDocumentField,
  DonorMolecularDataProcessingStatus,
  DonorMolecularDataReleaseStatus,
  BaseQueryArguments,
} from './types';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX } from 'config';
import logger from 'utils/logger';

type DonorStatsResolverType = GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  BaseQueryArguments & {
    filters: ProgramDonorSummaryFilter[];
  }
>;

const programDonorSummaryStatsResolver: (
  esClient: Client,
) => DonorStatsResolverType = esClient => async (
  source,
  args,
  context,
): Promise<ProgramDonorSummaryStatsGqlResponse> => {
  const { programShortName, filters } = args;

  type AggregationName =
    | keyof ProgramDonorSummaryStats
    | 'donorsWithAllCoreClinicalData'
    | 'donorsInvalidWithCurrentDictionary';

  const filterAggregation = (name: AggregationName, filterQuery?: esb.Query | undefined) =>
    esb.filterAggregation(name, filterQuery);

  const esQuery = esb
    .requestBodySearch()
    .query(esb.boolQuery().must([esb.matchQuery(EsDonorDocumentField.programId, programShortName)]))
    .aggs([
      filterAggregation('fullyReleasedDonorsCount' as AggregationName).filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.releaseStatus)
          .values([DonorMolecularDataReleaseStatus.FULLY_RELEASED]),
      ),
      filterAggregation('partiallyReleasedDonorsCount' as AggregationName).filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.releaseStatus)
          .values([DonorMolecularDataReleaseStatus.PARTIALLY_RELEASED]),
      ),
      filterAggregation('noReleaseDonorsCount' as AggregationName).filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.releaseStatus)
          .values([DonorMolecularDataReleaseStatus.NO_RELEASE, '']),
      ),
      filterAggregation('donorsProcessingMolecularDataCount' as AggregationName).filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.processingStatus)
          .values([DonorMolecularDataProcessingStatus.PROCESSING]),
      ),
      filterAggregation('donorsWithReleasedFilesCount' as AggregationName).filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.releaseStatus)
          .values([
            DonorMolecularDataReleaseStatus.PARTIALLY_RELEASED,
            DonorMolecularDataReleaseStatus.FULLY_RELEASED,
          ]),
      ),
      filterAggregation('donorsWithPublishedNormalAndTumourSamples' as AggregationName).filter(
        esb.boolQuery().must([
          esb
            .rangeQuery()
            .field(EsDonorDocumentField.publishedTumourAnalysis)
            .gt(0),
          esb
            .rangeQuery()
            .field(EsDonorDocumentField.publishedTumourAnalysis)
            .gt(0),
        ]),
      ),
      filterAggregation('donorsWithAllCoreClinicalData' as AggregationName).filter(
        esb
          .rangeQuery()
          .field(EsDonorDocumentField.submittedCoreDataPercent)
          .gte(1),
      ),
      filterAggregation('donorsInvalidWithCurrentDictionary' as AggregationName).filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.validWithCurrentDictionary)
          .values([false]),
      ),
      esb
        .sumAggregation('allFilesCount' as AggregationName)
        .field(EsDonorDocumentField.totalFilesCount),
      esb
        .sumAggregation('filesToQcCount' as AggregationName)
        .field(EsDonorDocumentField.filesToQcCount),
      esb.maxAggregation('lastUpdate' as AggregationName).field(EsDonorDocumentField.updatedAt),
    ]);

  type FilterAggregationResult = { doc_count: number };
  type NumericAggregationResult = { value: number };
  type DateAggregationResult = { value: Date };
  type QueryResult = {
    hits: {
      total: { value: number; relation: string };
    };
    aggregations: {
      fullyReleasedDonorsCount: FilterAggregationResult;
      partiallyReleasedDonorsCount: FilterAggregationResult;
      noReleaseDonorsCount: FilterAggregationResult;
      donorsProcessingMolecularDataCount: FilterAggregationResult;
      donorsWithReleasedFilesCount: FilterAggregationResult;
      donorsWithPublishedNormalAndTumourSamples: FilterAggregationResult;
      donorsWithAllCoreClinicalData: FilterAggregationResult;
      donorsInvalidWithCurrentDictionary: FilterAggregationResult;
      allFilesCount: NumericAggregationResult;
      filesToQcCount: NumericAggregationResult;
      lastUpdate?: DateAggregationResult;
    };
  };
  const { aggregations, hits }: QueryResult = await esClient
    .search({
      index: ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX,
      track_total_hits: true,
      size: 0, // number of hits to retrieve, we're not interested in hits
      body: esQuery,
    })
    .then(response => response.body)
    .catch(err => {
      logger.error('error reading data from Elasticsearch: ', err);
      const defaultQueryResult: QueryResult = {
        aggregations: {
          fullyReleasedDonorsCount: { doc_count: 0 },
          partiallyReleasedDonorsCount: { doc_count: 0 },
          noReleaseDonorsCount: { doc_count: 0 },
          donorsProcessingMolecularDataCount: { doc_count: 0 },
          donorsWithReleasedFilesCount: { doc_count: 0 },
          donorsWithPublishedNormalAndTumourSamples: { doc_count: 0 },
          donorsWithAllCoreClinicalData: { doc_count: 0 },
          donorsInvalidWithCurrentDictionary: { doc_count: 0 },
          allFilesCount: { value: 0 },
          filesToQcCount: { value: 0 },
        },
        hits: {
          total: {
            relation: '',
            value: 0,
          },
        },
      };
      return defaultQueryResult;
    });

  return {
    id: `${programShortName}::${stringify(filters)}`,
    programShortName: programShortName,
    registeredDonorsCount: hits.total.value,
    fullyReleasedDonorsCount: aggregations.fullyReleasedDonorsCount.doc_count,
    partiallyReleasedDonorsCount: aggregations.partiallyReleasedDonorsCount.doc_count,
    noReleaseDonorsCount: aggregations.noReleaseDonorsCount.doc_count,
    donorsProcessingMolecularDataCount: aggregations.donorsProcessingMolecularDataCount.doc_count,
    donorsWithReleasedFilesCount: aggregations.donorsWithReleasedFilesCount.doc_count,
    percentageTumourAndNormal: hits.total.value
      ? aggregations.donorsWithPublishedNormalAndTumourSamples.doc_count / hits.total.value
      : 0,
    percentageCoreClinical: hits.total.value
      ? aggregations.donorsWithAllCoreClinicalData.doc_count / hits.total.value
      : 0,
    allFilesCount: aggregations.allFilesCount.value,
    filesToQcCount: aggregations.filesToQcCount.value,
    donorsInvalidWithCurrentDictionaryCount:
      aggregations.donorsInvalidWithCurrentDictionary.doc_count,
    lastUpdate: aggregations.lastUpdate?.value ? new Date(aggregations.lastUpdate.value) : undefined,
  };
};

export default programDonorSummaryStatsResolver;
