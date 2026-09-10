import io.shiftleft.codepropertygraph.generated.nodes.{Method, StoredNode}
import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}
import scala.collection.mutable

@main def exec(cpgFile: String, mode: String, symbol: String, target: String, depth: String, outFile: String) = {
  importCpg(cpgFile)

  val maxDepth = depth.toIntOption.filter(_ >= 1).getOrElse(2)

  def jsonString(value: String): String = {
    val escaped = value.flatMap {
      case '"' => "\\\""
      case '\\' => "\\\\"
      case '\b' => "\\b"
      case '\f' => "\\f"
      case '\n' => "\\n"
      case '\r' => "\\r"
      case '\t' => "\\t"
      case c if c < ' ' => f"\\u${c.toInt}%04x"
      case c => c.toString
    }
    s"\"$escaped\""
  }

  def optionalInt(value: Option[Int]): String = value.map(_.toString).getOrElse("null")

  def methodJson(method: Method, distance: Option[Int] = None): String = {
    val fields = mutable.ArrayBuffer(
      s"\"id\":${method.id}",
      s"\"name\":${jsonString(method.name)}",
      s"\"fullName\":${jsonString(method.fullName)}",
      s"\"signature\":${jsonString(method.signature)}",
      s"\"file\":${jsonString(method.filename)}",
      s"\"line\":${optionalInt(method.lineNumber)}"
    )
    distance.foreach(value => fields += s"\"depth\":$value")
    fields.mkString("{", ",", "}")
  }

  def methodsJson(methods: Iterable[Method]): String =
    methods.toList
      .sortBy(method => (method.filename, method.lineNumber.getOrElse(Int.MaxValue), method.fullName))
      .map(method => methodJson(method))
      .mkString("[", ",", "]")

  def usageJson(node: StoredNode): String = {
    val method = node.method.headOption
    val parentCall = node.inCall.headOption
    val fields = mutable.ArrayBuffer(
      s"\"id\":${node.id}",
      s"\"code\":${jsonString(node.code)}",
      s"\"line\":${optionalInt(node.lineNumber)}",
      s"\"column\":${optionalInt(node.columnNumber)}",
      s"\"method\":${jsonString(method.map(_.name).getOrElse(""))}",
      s"\"methodFullName\":${jsonString(method.map(_.fullName).getOrElse(""))}",
      s"\"file\":${jsonString(method.map(_.filename).getOrElse(""))}",
      s"\"call\":${jsonString(parentCall.map(_.name).getOrElse(""))}",
      s"\"callCode\":${jsonString(parentCall.map(_.code).getOrElse(""))}"
    )
    fields.mkString("{", ",", "}")
  }

  val allMethods = cpg.method.filter(method => !method.isExternal).l.distinctBy(_.id)
  val byId = allMethods.map(method => method.id -> method).toMap

  def select(query: String): List[Method] =
    allMethods.filter(method => method.name == query || method.fullName == query)

  def neighborIds(methodId: Long, direction: String): List[Long] = {
    byId.get(methodId).toList.flatMap { method =>
      val neighbors = direction match {
        case "up" => method.start.caller.filter(candidate => !candidate.isExternal).l
        case _ => method.start.callee.filter(candidate => !candidate.isExternal).l
      }
      neighbors.map(_.id).filter(byId.contains).distinct
    }
  }

  def expand(startIds: List[Long], direction: String, limit: Int): Map[Long, Int] = {
    val distances = mutable.LinkedHashMap.empty[Long, Int]
    val queue = mutable.Queue.empty[(Long, Int)]

    startIds.distinct.foreach { id =>
      distances(id) = 0
      queue.enqueue((id, 0))
    }

    while (queue.nonEmpty) {
      val (current, currentDepth) = queue.dequeue()
      if (currentDepth < limit) {
        neighborIds(current, direction).foreach { next =>
          if (!distances.contains(next)) {
            distances(next) = currentDepth + 1
            queue.enqueue((next, currentDepth + 1))
          }
        }
      }
    }

    distances.toMap.filter(_._2 > 0)
  }

  def distanceMethodsJson(distances: Map[Long, Int]): String =
    distances.toList
      .flatMap { case (id, value) => byId.get(id).map(method => (method, value)) }
      .sortBy { case (method, value) => (value, method.filename, method.lineNumber.getOrElse(Int.MaxValue), method.fullName) }
      .map { case (method, value) => methodJson(method, Some(value)) }
      .mkString("[", ",", "]")

  val roots = select(symbol)
  val rootIds = roots.map(_.id)

  val output = mode match {
    case "symbol" =>
      s"{\"command\":\"symbol\",\"query\":${jsonString(symbol)},\"matches\":${methodsJson(roots)}}"

    case "callers" =>
      val results = rootIds.flatMap(id => neighborIds(id, "up")).distinct.flatMap(byId.get)
      s"{\"command\":\"callers\",\"query\":${jsonString(symbol)},\"roots\":${methodsJson(roots)},\"results\":${methodsJson(results)}}"

    case "callees" =>
      val results = rootIds.flatMap(id => neighborIds(id, "down")).distinct.flatMap(byId.get)
      s"{\"command\":\"callees\",\"query\":${jsonString(symbol)},\"roots\":${methodsJson(roots)},\"results\":${methodsJson(results)}}"

    case "impact" =>
      val upstream = expand(rootIds, "up", maxDepth)
      val downstream = expand(rootIds, "down", maxDepth)
      s"{\"command\":\"impact\",\"query\":${jsonString(symbol)},\"depth\":$maxDepth,\"roots\":${methodsJson(roots)},\"upstream\":${distanceMethodsJson(upstream)},\"downstream\":${distanceMethodsJson(downstream)}}"

    case "path" =>
      val targets = select(target)
      val targetIds = targets.map(_.id).toSet
      val queue = mutable.Queue.empty[(Long, List[Long], Int)]
      val visited = mutable.Set.empty[Long]
      rootIds.distinct.foreach(id => queue.enqueue((id, List(id), 0)))
      var found: Option[List[Long]] = None

      while (queue.nonEmpty && found.isEmpty) {
        val (current, currentPath, currentDepth) = queue.dequeue()
        if (!visited.contains(current)) {
          visited += current
          if (targetIds.contains(current)) {
            found = Some(currentPath)
          } else if (currentDepth < maxDepth) {
            neighborIds(current, "down").foreach { next =>
              if (!visited.contains(next)) queue.enqueue((next, currentPath :+ next, currentDepth + 1))
            }
          }
        }
      }

      val pathJson = found match {
        case Some(ids) => ids.flatMap(byId.get).map(method => methodJson(method)).mkString("[", ",", "]")
        case None => "null"
      }
      s"{\"command\":\"path\",\"from\":${jsonString(symbol)},\"to\":${jsonString(target)},\"maxDepth\":$maxDepth,\"fromMatches\":${methodsJson(roots)},\"toMatches\":${methodsJson(targets)},\"path\":$pathJson}"

    case "usages" =>
      val identifiers = cpg.identifier.nameExact(symbol).l
      val locals = cpg.local.nameExact(symbol).l
      val params = cpg.method.parameter.nameExact(symbol).l
      val identifierJson = identifiers.sortBy(node => (node.method.headOption.map(_.filename).getOrElse(""), node.lineNumber.getOrElse(Int.MaxValue), node.id)).map(usageJson).mkString("[", ",", "]")
      val declarationCount = locals.size + params.size
      s"{\"command\":\"usages\",\"query\":${jsonString(symbol)},\"declarationCount\":$declarationCount,\"usageCount\":${identifiers.size},\"usages\":$identifierJson}"

    case other =>
      throw new IllegalArgumentException(s"Unsupported CPG query mode: $other")
  }

  Files.writeString(Paths.get(outFile), output + "\n", StandardCharsets.UTF_8)
}
