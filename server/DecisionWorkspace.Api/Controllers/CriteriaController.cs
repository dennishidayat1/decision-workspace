using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Services;

namespace DecisionWorkspace.Api.Controllers;

[Route("api/decisions/{decisionId:guid}/criteria")]
[ApiController]
[Authorize]
public class CriteriaController : ControllerBase
{
    private readonly CriterionService _criterionService;

    public CriteriaController(CriterionService criterionService)
    {
        _criterionService = criterionService;
    }

    private Guid GetUserId()
    {
        var userId = User.FindFirst("sub")?.Value;

        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            throw new UnauthorizedAccessException("Invalid user ID.");
        }

        return parsedUserId;
    }

    [HttpPost]
    public async Task<IActionResult> CreateCriterion(
        Guid decisionId,
        [FromBody] CreateCriterionRequest request
    )
    {
        var criterion = await _criterionService.CreateCriterionAsync(
            GetUserId(),
            decisionId,
            request
        );

        if (criterion == null)
        {
            return NotFound();
        }

        return Ok(criterion);
    }

    [HttpGet]
    public async Task<IActionResult> GetCriteriaByDecisionId(Guid decisionId)
    {
        var criteria = await _criterionService.GetByDecisionIdAsync(
            GetUserId(),
            decisionId
        );

        if (criteria == null)
        {
            return NotFound();
        }

        return Ok(criteria);
    }

    [HttpPut("{criterionId:guid}")]
    public async Task<IActionResult> UpdateCriterion(
        Guid decisionId,
        Guid criterionId,
        [FromBody] CreateCriterionRequest request
    )
    {
        var criterion = await _criterionService.UpdateCriterionAsync(
            GetUserId(),
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
        var deleted = await _criterionService.DeleteCriterionAsync(
            GetUserId(),
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