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

    [HttpPut("{criterionId:guid}")]
    public async Task<IActionResult> UpdateCriterion(Guid decisionId, Guid criterionId, [FromBody] CreateCriterionRequest request)
    {
        var criterion =
            await _criterionService.UpdateCriterionAsync(
                decisionId,
                criterionId,
                request
            );

        if (criterion == null)
        {
            return NotFound();
        }

        return Ok(criterion);
    }


    [HttpDelete("{criterionId:guid}")]
    public async Task<IActionResult> DeleteCriterion(
        Guid decisionId,
        Guid criterionId
    )
    {
        var deleted =
            await _criterionService.DeleteCriterionAsync(
                decisionId,
                criterionId
            );

        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }
}