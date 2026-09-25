using Microsoft.AspNetCore.Mvc;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Services;

namespace DecisionWorkspace.Api.Controllers;

[Route("api/decisions/{decisionId:guid}/criteria")]
[ApiController]
public class CriteriaController : ControllerBase
{
    private readonly CriterionService _criterionService;

    public CriteriaController(CriterionService criterionService)
    {
        _criterionService = criterionService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateCriterion(Guid decisionId, [FromBody] CreateCriterionRequest request)
    {
        var criterion = await _criterionService.CreateCriterionAsync(decisionId, request);

        if (criterion == null)
        {
            return NotFound();
        }

        return Ok(criterion);
    }

    [HttpGet]
    public async Task<IActionResult> GetCriteriaByDecisionId(Guid decisionId)
    {
        var criteria = await _criterionService.GetByDecisionIdAsync(decisionId);

        if (criteria == null)
        {
            return NotFound();
        }

        return Ok(criteria);
    }
}