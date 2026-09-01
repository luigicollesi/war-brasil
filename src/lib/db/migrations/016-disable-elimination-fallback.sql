-- O War-Brasil considera o objetivo de eliminação cumprido quando o alvo fica
-- sem territórios, independentemente de quem realizou a última conquista.
-- O fallback histórico deixa de participar de novas partidas.
UPDATE objectives
SET fallback_objective_id = NULL
WHERE type IN ('elimination', 'elimination_plus')
  AND fallback_objective_id IS NOT NULL;
