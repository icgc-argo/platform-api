import { Client } from '@elastic/elasticsearch';
import { Response, Handler } from 'express';
import { AuthenticatedRequest } from 'routes/middleware/authenticatedRequestMiddleware';
import egoTokenUtils from 'utils/egoTokenUtils';
import _ from 'lodash';
import { ARRANGER_FILE_CENTRIC_INDEX } from 'config';
import esb from 'elastic-builder';
import { SongEntity, toSongEntity } from '../utils';
import {
  EsFileCentricDocument,
  FILE_METADATA_FIELDS,
  FILE_EMBARGO_STAGE,
} from 'utils/commonTypes/EsFileCentricDocument';
import { EsHits } from 'services/elasticsearch';

export type EntitiesPageResponseBody = {
  content: Array<Partial<SongEntity>>;
  pageable: {
    offset: number;
    sort: {
      sorted: boolean;
      unsorted: boolean;
      empty: boolean;
    };
    pageSize: number;
    pageNumber: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalPages: number;
  last: boolean;
  totalElements: number;
  first: boolean;
  sort: {
    sorted: boolean;
    unsorted: boolean;
    empty: boolean;
  };
  numberOfElements: number;
  size: number;
  number: number;
  empty: boolean;
};

type RequestBodyQuery = {
  access: string;
  fields: string;
  fileName: string;
  analysisId: string;
  id: string;
  page: string;
  projectCode: string;
  size: string;
};

const FILE_EMBARGO_FILTER_FIELD = FILE_METADATA_FIELDS['embargo_stage'];

const emptyFilter = () => esb.boolQuery();

const getAccessControlFilter = (
  programMembershipAccessLevel: ReturnType<typeof egoTokenUtils.getProgramMembershipAccessLevel>,
  userPrograms: string[],
): esb.Query => {
  /* Logical operator shorthands */
  const all = (conditions: esb.Query[]): esb.BoolQuery => esb.boolQuery().must(conditions);
  const not = (conditions: esb.Query[]): esb.BoolQuery => esb.boolQuery().mustNot(conditions);
  /*******************************/

  /* common filters */
  const isFromOtherPrograms = not([esb.termsQuery(FILE_METADATA_FIELDS['study_id'], userPrograms)]);
  const isUnReleasedFromOtherPrograms = all([
    isFromOtherPrograms,
    esb.termsQuery(FILE_EMBARGO_FILTER_FIELD, FILE_EMBARGO_STAGE.OWN_PROGRAM),
  ]);
  /******************/

  const userPermissionToQueryMap: {
    [accessLevel in typeof programMembershipAccessLevel]: esb.Query;
  } = {
    DCC_MEMBER: emptyFilter(),
    FULL_PROGRAM_MEMBER: not([isUnReleasedFromOtherPrograms]),
    ASSOCIATE_PROGRAM_MEMBER: all([
      not([isUnReleasedFromOtherPrograms]),
      not([
        all([
          isFromOtherPrograms,
          esb.termQuery(FILE_EMBARGO_FILTER_FIELD, FILE_EMBARGO_STAGE.FULL_PROGRAMS),
        ]),
      ]),
    ]),
    PUBLIC_MEMBER: esb.termsQuery(FILE_EMBARGO_FILTER_FIELD, FILE_EMBARGO_STAGE.PUBLIC),
  };
  return userPermissionToQueryMap[programMembershipAccessLevel];
};

const createEntitiesHandler = ({ esClient }: { esClient: Client }): Handler => {
  return async (req: AuthenticatedRequest, res: Response<EntitiesPageResponseBody>) => {
    const serializedUserScopes = req.auth.serializedScopes;
    const programMembershipAccessLevel = egoTokenUtils.getProgramMembershipAccessLevel({
      permissions: serializedUserScopes,
    });

    const parsedRequestQuery = {
      page: Number(req.query.page || 0),
      size: Number(req.query.size || 10),
      access: req.query.access,
      fields: req.query.fields
        ? (req.query.fields as string)
            .split(',')
            .map(str => str.trim())
            .filter(_.identity)
        : [],
      fileName: req.query.fileName || undefined,
      id: req.query.id || undefined,
      analysisId: req.query.analysisId || undefined,
      projectCode: req.query.projectCode || undefined,
    };

    const accessControlFilter = getAccessControlFilter(programMembershipAccessLevel, [
      ...egoTokenUtils.getReadableProgramDataNames(serializedUserScopes),
    ]);

    const query = esb
      .requestBodySearch()
      .from(parsedRequestQuery.page * parsedRequestQuery.size)
      .size(parsedRequestQuery.size)
      .sorts([esb.sort(FILE_METADATA_FIELDS['object_id'])])
      .query(
        esb
          .boolQuery()
          // TODO: All of the `as string` casting in this section was added to silence the typescript compiler, it needs to be tested
          // the solution is likely in the types being applied to the Request object, such that it doesnt know if the query params are string or parsed into arrays
          .must([
            parsedRequestQuery.id
              ? esb.termsQuery(FILE_METADATA_FIELDS['object_id'], parsedRequestQuery.id as string)
              : emptyFilter(),
            parsedRequestQuery.fileName
              ? esb.termsQuery(
                  FILE_METADATA_FIELDS['file.name'],
                  parsedRequestQuery.fileName as string,
                )
              : emptyFilter(),
            parsedRequestQuery.access
              ? esb.termsQuery(
                  FILE_METADATA_FIELDS['file_access'],
                  parsedRequestQuery.access as string,
                )
              : emptyFilter(),
            parsedRequestQuery.analysisId
              ? esb.termsQuery(
                  FILE_METADATA_FIELDS['analysis.analysis_id'],
                  parsedRequestQuery.analysisId as string,
                )
              : emptyFilter(),
            parsedRequestQuery.projectCode
              ? esb.termsQuery(
                  FILE_METADATA_FIELDS['study_id'],
                  parsedRequestQuery.projectCode as string,
                )
              : emptyFilter(),
            accessControlFilter,
          ]),
      );

    const esSearchResponse: { body: EsHits<EsFileCentricDocument> } = await esClient.search({
      index: ARRANGER_FILE_CENTRIC_INDEX,
      body: query,
    });

    const data: Partial<SongEntity>[] = esSearchResponse.body.hits.hits
      .map(({ _source }) => _source)
      .map(toSongEntity)
      .map(file =>
        parsedRequestQuery.fields.length
          ? (Object.fromEntries(
              Object.entries(file).filter(([key]) => parsedRequestQuery.fields.includes(key)),
            ) as Partial<SongEntity>)
          : file,
      );

    /**@todo: get Rob to take a look through this */
    const responseBody: EntitiesPageResponseBody = {
      content: data,
      pageable: {
        offset: parsedRequestQuery.page,
        pageNumber: parsedRequestQuery.page,
        pageSize: data.length,
        paged: true,
        sort: {
          sorted: false,
          unsorted: true,
          empty: true,
        },
        unpaged: false,
      },
      empty: !!data.length,
      first: parsedRequestQuery.page === 0,
      last: data.length < parsedRequestQuery.size,
      size: data.length,
      totalElements: esSearchResponse.body.hits.total.value,
      numberOfElements: data.length,
      sort: {
        sorted: false,
        unsorted: true,
        empty: true,
      },
      number: data.length,
      totalPages: esSearchResponse.body.hits.total.value / parsedRequestQuery.size,
    };

    res.send(responseBody);
  };
};

export default createEntitiesHandler;
