import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { addDomain, removeDomain } from './requests';
import { IDomainRequest, IRequest } from '../types';

export const useDomainEndpoint = () => {
  const [domain, setDomain] = useState<IDomainRequest>({
    domain: '',
    action: '',
  });
  const request: IRequest = useMemo(() => {
    return domain.action === 'add'
      ? addDomain(domain.domain)
      : removeDomain(domain.domain);
  }, [domain]);

  const [addDomainResponse, addDomainErrorResponse] = useApiResults<any>(
    request,
    null
  );

  return [addDomainResponse, addDomainErrorResponse, setDomain] as const;
};
