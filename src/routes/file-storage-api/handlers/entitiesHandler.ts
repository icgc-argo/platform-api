import { Client } from '@elastic/elasticsearch';
import { Request, Response, Handler } from 'express';
import { AuthenticatedRequest } from '../accessValidations';
import egoTokenUtils from 'utils/egoTokenUtils';
import _ from 'lodash';
import { ARRANGER_FILE_CENTRIC_INDEX, EGO_DACO_POLICY_NAME } from 'config';
import esb from 'elastic-builder';
import { SongEntity, toSongEntity } from '../utils';
import {
  EsFileCentricDocument,
  FILE_METADATA_FIELDS,
  FILE_RELEASE_STAGE,
} from 'utils/commonTypes/EsFileCentricDocument';
import { EsHits } from 'services/elasticsearch';

type ResponseBody = {
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

const emptyFilter = esb.boolQuery();

const getAccessControlFilter = (
  programMembershipAccessLevel: ReturnType<typeof egoTokenUtils.getProgramMembershipAccessLevel>,
  userPrograms: string[],
): esb.Query => {
  const ownProgramFilter = esb
    .boolQuery()
    .mustNot([
      esb.boolQuery().mustNot(esb.termsQuery(FILE_METADATA_FIELDS['program_id'], userPrograms)),
      esb.termsQuery(FILE_METADATA_FIELDS['release_stage'], FILE_RELEASE_STAGE.OWN_PROGRAM),
    ]);
  return ({
    DCC_MEMBER: emptyFilter,
    FULL_PROGRAM_MEMBER: ownProgramFilter,
    ASSOCIATE_PROGRAM_MEMBER: esb
      .boolQuery()
      .must([
        ownProgramFilter,
        esb
          .boolQuery()
          .must([
            esb
              .boolQuery()
              .mustNot(esb.termsQuery(FILE_METADATA_FIELDS['program_id'], userPrograms)),
            esb.termQuery(FILE_METADATA_FIELDS['release_stage'], FILE_RELEASE_STAGE.FULL_PROGRAMS),
          ]),
      ]),
    PUBLIC_MEMBER: esb.termsQuery(FILE_METADATA_FIELDS['release_stage'], FILE_RELEASE_STAGE.PUBLIC),
  } as { [accessLevel in typeof programMembershipAccessLevel]: esb.Query })[
    programMembershipAccessLevel
  ];
};

const createEntitiesHandler = ({ esClient }: { esClient: Client }): Handler => {
  return async (
    req: AuthenticatedRequest<{}, any, any, RequestBodyQuery>,
    res: Response<ResponseBody>,
    next,
  ) => {
    const userScopes = req.userScopes;
    const isDacoApproved = userScopes.some(
      s => s.policy === EGO_DACO_POLICY_NAME && s.permission !== 'DENY',
    );
    const programMembershipAccessLevel = egoTokenUtils.getProgramMembershipAccessLevel({
      permissions: userScopes.map(egoTokenUtils.serializeScope),
    });

    const parsedRequestQuery = {
      page: Number(req.query.page || 0),
      size: Number(req.query.size || 10),
      access: req.query.access,
      fields: req.query.fields
        ? req.query.fields
            .split(',')
            .map(str => str.trim())
            .filter(_.identity)
        : [],
      fileName: req.query.fileName || undefined,
      id: req.query.id || undefined,
      analysisId: req.query.analysisId || undefined,
      projectCode: req.query.projectCode || undefined,
    };

    const accessControlFilter = getAccessControlFilter(
      programMembershipAccessLevel,
      egoTokenUtils.getReadableProgramShortNames(req.userScopes),
    );

    const query = esb
      .requestBodySearch()
      .from(parsedRequestQuery.page)
      .size(parsedRequestQuery.size)
      .query(
        esb
          .boolQuery()
          .must([
            parsedRequestQuery.id
              ? esb.termsQuery(FILE_METADATA_FIELDS['object_id'], parsedRequestQuery.id)
              : emptyFilter,
            parsedRequestQuery.fileName
              ? esb.termsQuery(FILE_METADATA_FIELDS['file.name'], parsedRequestQuery.fileName)
              : emptyFilter,
            parsedRequestQuery.access
              ? esb.termsQuery(FILE_METADATA_FIELDS['file_access'], parsedRequestQuery.access)
              : emptyFilter,
            parsedRequestQuery.analysisId
              ? esb.termsQuery(
                  FILE_METADATA_FIELDS['analysis.analysis_id'],
                  parsedRequestQuery.analysisId,
                )
              : emptyFilter,
            parsedRequestQuery.projectCode
              ? esb.termsQuery(FILE_METADATA_FIELDS['program_id'], parsedRequestQuery.projectCode)
              : emptyFilter,
            accessControlFilter,
          ]),
      );

    console.log('query: ', query.toJSON());

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

    const responseBody: ResponseBody = {
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

    console.log('responseBody: ', responseBody);

    res.send(responseBody);
  };
};

export default createEntitiesHandler;
